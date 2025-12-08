// src/routes/mtd.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// NOTE: version is v2.2 (with a "v")
const BASE = 'https://developer.mtd.org/api/v2.2/json';
const MTD_KEY = process.env.MTD_API_KEY;

if (!MTD_KEY) {
  console.warn('⚠️  MTD_API_KEY not set — /api/mtd routes will fail');
}

// Hard-coded fallback coordinates for a few key stops.
// These are "good enough" for the class project / demo.
const FALLBACK_COORDS = {
  IU: { lat: 40.1099, lon: -88.2272 },   // Illini Union
  'IU:1': { lat: 40.1099, lon: -88.2272 }
};

// Build URLs with key + params
function mtdUrl(method, params) {
  const usp = new URLSearchParams({ key: MTD_KEY, ...params });
  return `${BASE}/${method}?${usp.toString()}`;
}

// Try to extract latitude/longitude from various possible field names
function extractLatLon(obj) {
  if (!obj || typeof obj !== 'object') return { lat: null, lon: null };

  const lat =
    obj.stop_lat ??
    obj.stop_latitude ??
    obj.latitude ??
    obj.lat ??
    null;

  const lon =
    obj.stop_lon ??
    obj.stop_longitude ??
    obj.longitude ??
    obj.lon ??
    null;

  return { lat, lon };
}

// ------------------- STOP TIMES (schedule) -------------------
// GET /api/mtd/stop-times?stop_id=IU:1
router.get('/stop-times', async (req, res) => {
  try {
    const { stop_id } = req.query;
    if (!stop_id) {
      return res.status(400).json({ error: 'stop_id required' });
    }
    if (!MTD_KEY) {
      return res.status(500).json({ error: 'missing-mtd-key' });
    }

    const today = new Date();
    const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(today.getDate()).padStart(2, '0')}`;

    // https://developer.mtd.org/api/{version}/{format}/getstoptimesbystop
    const url = mtdUrl('getstoptimesbystop', { stop_id, date });

    const resp = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (resp.status !== 200) {
      console.error('MTD stop-times upstream error', resp.status, resp.data);
      return res.status(502).json({
        error: 'upstream-error',
        status: resp.status,
        body: resp.data
      });
    }

    return res.json(resp.data || {});
  } catch (err) {
    console.error('mtd /stop-times error', err.message || err);
    return res.status(500).json({ error: 'mtd-stop-times-failed' });
  }
});

// ------------------- STOP INFO (lat/lon for map) -------------------
// GET /api/mtd/stop-info?stop_id=IU:1
// Uses GetStop + hard-coded fallback coords so the map always has something.
router.get('/stop-info', async (req, res) => {
  const { stop_id } = req.query || {};
  if (!stop_id) {
    return res.status(400).json({ error: 'stop_id required' });
  }

  const parentId = stop_id.split(':')[0];

  try {
    if (!MTD_KEY) {
      console.warn('MTD key missing, using fallback coords only');
    } else {
      // https://developer.mtd.org/api/{version}/{format}/GetStop
      const url = mtdUrl('GetStop', { stop_id: parentId });

      const resp = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (resp.status === 200 && resp.data) {
        const raw = resp.data;
        const candidates = [];

        // Top-level object
        candidates.push(raw);

        // Any nested stops / stop_points if present
        if (Array.isArray(raw.stops)) candidates.push(...raw.stops);
        if (Array.isArray(raw.stop_point)) candidates.push(...raw.stop_point);

        let chosen =
          candidates.find((s) => s.stop_id === stop_id) ||
          candidates.find(
            (s) =>
              typeof s.stop_id === 'string' && s.stop_id.startsWith(parentId)
          ) ||
          candidates[0];

        const { lat, lon } = extractLatLon(chosen);
        const stop_name =
          chosen.stop_name || raw.stop_name || 'Unknown stop (MTD)';

        if (lat != null && lon != null) {
          return res.json({
            stop_id: chosen.stop_id || stop_id,
            stop_name,
            stop_lat: lat,
            stop_lon: lon,
            source: 'mtd'
          });
        }

        console.warn(
          'MTD GetStop returned no lat/lon; will try fallback. keys =',
          Object.keys(chosen || {})
        );
      } else {
        console.error(
          'MTD GetStop upstream error',
          resp.status,
          resp.data && resp.data.status
        );
      }
    }
  } catch (err) {
    console.error('mtd /stop-info GetStop error', err.message || err);
  }

  // If we reach here, either MTD failed or had no coords: use fallback table.
  const fb = FALLBACK_COORDS[stop_id] || FALLBACK_COORDS[parentId];
  if (fb) {
    return res.json({
      stop_id,
      stop_name: parentId === 'IU' ? 'Illini Union' : 'Unknown stop',
      stop_lat: fb.lat,
      stop_lon: fb.lon,
      source: 'fallback'
    });
  }

  return res.status(404).json({ error: 'stop-not-found-no-fallback' });
});

// ------------------- LIVE DEPARTURES (for shape_id) -------------------
// GET /api/mtd/departures?stop_id=IU:1
router.get('/departures', async (req, res) => {
  try {
    const { stop_id } = req.query;
    if (!stop_id) {
      return res.status(400).json({ error: 'stop_id required' });
    }
    if (!MTD_KEY) {
      return res.status(500).json({ error: 'missing-mtd-key' });
    }

    // https://developer.mtd.org/api/{version}/{format}/GetDeparturesByStop
    const url = mtdUrl('GetDeparturesByStop', { stop_id });

    const resp = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (resp.status !== 200) {
      console.error('MTD departures upstream error', resp.status, resp.data);
      return res.status(502).json({
        error: 'upstream-error',
        status: resp.status,
        body: resp.data
      });
    }

    return res.json(resp.data || {});
  } catch (err) {
    console.error('mtd /departures error', err.message || err);
    res.status(500).json({ error: 'mtd-departures-failed' });
  }
});

// ------------------- SHAPE (polyline for route) -------------------
// GET /api/mtd/shape?shape_id=XYZ
router.get('/shape', async (req, res) => {
  try {
    const { shape_id } = req.query;
    if (!shape_id) {
      return res.status(400).json({ error: 'shape_id required' });
    }
    if (!MTD_KEY) {
      return res.status(500).json({ error: 'missing-mtd-key' });
    }

    // https://developer.mtd.org/api/{version}/{format}/GetShape
    const url = mtdUrl('GetShape', { shape_id });

    const resp = await axios.get(url, {
      timeout: 10000,
      validateStatus: () => true
    });

    if (resp.status !== 200) {
      console.error('MTD shape upstream error', resp.status, resp.data);
      return res.status(502).json({
        error: 'upstream-error',
        status: resp.status,
        body: resp.data
      });
    }

    return res.json(resp.data || {});
  } catch (err) {
    console.error('mtd /shape error', err.message || err);
    res.status(500).json({ error: 'mtd-shape-failed' });
  }
});

module.exports = router;
