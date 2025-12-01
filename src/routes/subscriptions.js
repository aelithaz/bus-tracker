const express = require('express');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

const router = express.Router();

// create a new subscription: { email, stop_id, trip_id }
router.post('/', async (req, res) => {
  try {
    const { email, stop_id, trip_id, notifyBeforeMinutes } = req.body;
    if (!email || !stop_id || !trip_id) return res.status(400).json({ error: 'email, stop_id and trip_id required' });

    if (notifyBeforeMinutes !== undefined) {
      const n = Number(notifyBeforeMinutes);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'notifyBeforeMinutes must be a non-negative number' });
    }

    // ensure the user exists (we don't require token at subscription time, but it's recommended)
    await User.findOneAndUpdate({ email }, { $setOnInsert: { email } }, { upsert: true });

    const set = { email, stop_id, trip_id };
    if (notifyBeforeMinutes !== undefined) set.notifyBeforeMinutes = Number(notifyBeforeMinutes);

    const sub = await Subscription.findOneAndUpdate(
      { email, stop_id, trip_id },
      { $set: set },
      { upsert: true, new: true }
    );

    res.json({ ok: true, subscription: sub });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// list subscriptions (for debugging)
router.get('/', async (req, res) => {
  const subs = await Subscription.find({}).limit(200);
  res.json({ count: subs.length, subs });
});

// list subscriptions for an email
router.get('/by-email/:email', async (req, res) => {
  const subs = await Subscription.find({ email: req.params.email });
  res.json({ count: subs.length, subs });
});

module.exports = router;
