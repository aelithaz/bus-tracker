// src/routes/mtd.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

// NOTE: version is v2.2 (with a "v")
const BASE = 'https://developer.cumtd.com/api/v2.2/json';
const MTD_KEY = process.env.MTD_API_KEY;

if (!MTD_KEY) {
  console.warn('⚠️  MTD_API_KEY not set — /api/mtd routes will fail');
}

// Hard-coded fallback coordinates for a few key stops.
// These are "good enough" for the class project / demo.
const FALLBACK_COORDS = {
  IU: { lat: 40.1099, lon: -88.2272 },   // Illini Union
  'IU:1': { lat: 40.1099, lon: -88.2272 },
  'IU:2': { lat: 40.1099, lon: -88.2272 }
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
    obj.stop_point_lat ??
    obj.stop_point_latitude ??
    obj.latitude ??
    obj.lat ??
    null;

  const lon =
    obj.stop_lon ??
    obj.stop_longitude ??
    obj.stop_point_lon ??
    obj.stop_point_longitude ??
    obj.longitude ??
    obj.lon ??
    null;

  return { lat, lon };
}

// Split stop id into parent stop and optional stop point.
// MTD endpoints generally want the parent stop id (ex: IU), not IU:1.
function parseStopId(stop_id) {
  const s = String(stop_id || '');
  const idx = s.indexOf(':');
  if (idx === -1) return { parentId: s, pointId: null };
  const parentId = s.slice(0, idx);
  const pointId = s;
  return { parentId, pointId };
}

function matchesPoint(obj, parentId, pointId) {
  if (!pointId) return true;
  if (!obj || typeof obj !== 'object') return false;

  const sp = obj.stop_point || obj.stopPoint || {};

  const candidates = [
    sp.stop_id,
    sp.stop_point_id,
    obj.stop_id,
    obj.stop_point_id
  ].filter(Boolean);

  for (const id of candidates) {
    if (id === pointId) return true;
    if (typeof id === 'string' && !id.includes(':') && `${parentId}:${id}` === pointId) return true;
  }

  return false;
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

    const { parentId, pointId } = parseStopId(stop_id);

    const today = new Date();
    const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(
      2,
      '0'
    )}${String(today.getDate()).padStart(2, '0')}`;

    // https://developer.mtd.org/api/{version}/{format}/getstoptimesbystop
    // Use parent stop id upstream, then filter locally for IU:1 if requested.
    const url = mtdUrl('getstoptimesbystop', { stop_id: parentId, date });

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

    const data = resp.data || {};
    if (pointId && Array.isArray(data.stop_times)) {
      data.stop_times = data.stop_times.filter((st) => matchesPoint(st, parentId, pointId));
    }

    return res.json(data);
  } catch (err) {
    console.error('mtd /stop-times error', req.query || err.message || err);
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

  const { parentId, pointId } = parseStopId(stop_id);

  try {
    if (!MTD_KEY) {
      console.warn('MTD key missing, using fallback coords only');
    } else {
      // https://developer.mtd.org/api/{version}/{format}/getstop
      // Use parent stop id upstream, then select the stop point locally.
      const url = mtdUrl('getstop', { stop_id: parentId });

      const resp = await axios.get(url, {
        timeout: 10000,
        validateStatus: () => true
      });

      if (resp.status === 200 && resp.data) {
        const raw = resp.data;

        const stopObj =
          (Array.isArray(raw.stops) && raw.stops[0]) ||
          raw.stop ||
          raw;

        const points = stopObj && Array.isArray(stopObj.stop_points) ? stopObj.stop_points : [];

        let chosen = stopObj;

        if (pointId && points.length > 0) {
          const match = points.find((p) => matchesPoint(p, parentId, pointId));
          if (match) chosen = match;
        }

        const { lat, lon } = extractLatLon(chosen);
        const stop_name =
          chosen.stop_name ||
          stopObj.stop_name ||
          raw.stop_name ||
          'Unknown stop (MTD)';

        if (lat != null && lon != null) {
          return res.json({
            stop_id: chosen.stop_id || pointId || parentId,
            stop_name,
            stop_lat: lat,
            stop_lon: lon,
            source: 'mtd'
          });
        }

        console.warn(
          'MTD getstop returned no lat/lon; will try fallback. keys =',
          Object.keys(chosen || {})
        );
      } else {
        console.error(
          'MTD getstop upstream error',
          resp.status,
          resp.data && resp.data.status
        );
      }
    }
  } catch (err) {
    console.error('mtd /stop-info getstop error', err.message || err);
  }

  // If we reach here, either MTD failed or had no coords: use fallback table.
  const fb = FALLBACK_COORDS[pointId || stop_id] || FALLBACK_COORDS[parentId];
  if (fb) {
    return res.json({
      stop_id: pointId || stop_id,
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

    const { parentId, pointId } = parseStopId(stop_id);

    const ptRaw = req.query.pt;
    const pt = ptRaw !== undefined ? Number(ptRaw) : 60;

    // https://developer.mtd.org/api/{version}/{format}/getdeparturesbystop
    // Use parent stop id upstream, then filter locally for IU:1 if requested.
    const url = mtdUrl('getdeparturesbystop', { stop_id: parentId, pt });

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

    const data = resp.data || {};
    if (pointId && Array.isArray(data.departures)) {
      data.departures = data.departures.filter((d) => matchesPoint(d, parentId, pointId));
    }

    return res.json(data);
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
