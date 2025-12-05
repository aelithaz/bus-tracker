// src/routes/mtd.js
const express = require('express');
const axios = require('axios');

const router = express.Router();

const MTD_KEY = process.env.MTD_API_KEY;
const BASE = 'https://developer.mtd.org/api/2.2/json';

if (!MTD_KEY) {
  console.warn('⚠️ MTD_API_KEY not set — /api/mtd routes will fail');
}

// GET /api/mtd/stop-times?stop_id=IT:1
router.get('/stop-times', async (req, res) => {
  try {
    const { stop_id } = req.query;
    if (!stop_id) {
      return res.status(400).json({ error: 'stop_id required' });
    }

    const today = new Date();
    const date = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(
      today.getDate()
    ).padStart(2, '0')}`;

    const url = `${BASE}/getstoptimesbystop?key=${encodeURIComponent(
      MTD_KEY
    )}&stop_id=${encodeURIComponent(stop_id)}&date=${date}`;

    const resp = await axios.get(url, { timeout: 10000 });
    const data = resp.data || {};

    // Just pass through for now; frontend will pick the bits it needs
    res.json(data);
  } catch (err) {
    console.error('mtd /stop-times error', err.message || err);
    res.status(500).json({ error: 'mtd-stop-times-failed' });
  }
});

// GET /api/mtd/stop-info?stop_id=IT:1
// Small helper that normalizes CUMTD's getstop response to
// { stop_id, stop_name, stop_lat, stop_lon }
router.get('/stop-info', async (req, res) => {
  try {
    const { stop_id } = req.query;
    if (!stop_id) {
      return res.status(400).json({ error: 'stop_id required' });
    }

    const url = `${BASE}/getstop?key=${encodeURIComponent(
      MTD_KEY
    )}&stop_id=${encodeURIComponent(stop_id)}`;

    const resp = await axios.get(url, { timeout: 10000 });
    const raw = resp.data || {};

    // CUMTD usually wraps stops in an array; be defensive
    let stop = null;
    if (Array.isArray(raw.stops)) stop = raw.stops[0];
    else if (Array.isArray(raw.stop_point)) stop = raw.stop_point[0];
    else if (raw.stop_id) stop = raw;

    if (!stop) {
      return res.status(404).json({ error: 'stop-not-found', raw });
    }

    res.json({
      stop_id: stop.stop_id,
      stop_name: stop.stop_name,
      stop_lat: stop.stop_lat,
      stop_lon: stop.stop_lon,
    });
  } catch (err) {
    console.error('mtd /stop-info error', err.message || err);
    res.status(500).json({ error: 'mtd-stop-info-failed' });
  }
});

module.exports = router;
