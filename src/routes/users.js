const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

// basic email + password register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    let user = await User.findOne({ email });
    if (!user) {
      user = new User({ email, passwordHash });
    } else {
      user.passwordHash = passwordHash;
    }

    await user.save();
    res.json({ ok: true, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// basic email + password login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'invalid' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'invalid' });
    }

    res.json({ ok: true, email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Register or add an FCM token for an email
router.post('/register-token', async (req, res) => {
  try {
    const { email, fcmToken } = req.body;
    if (!email || !fcmToken) {
      return res.status(400).json({ error: 'email and fcmToken required' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $addToSet: { fcmTokens: fcmToken } },
      { upsert: true, new: true }
    );

    res.json({ ok: true, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Return FCM tokens for a given email
router.get('/tokens/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: 'not-found' });
    res.json({ email: user.email, fcmTokens: user.fcmTokens });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// favorites for an email
router.get('/favorites/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({ email, favorites: [] });
    }
    res.json({ email: user.email, favorites: user.favorites || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// add a favorite stop_id
router.post('/favorites/add', async (req, res) => {
  try {
    const { email, stop_id } = req.body;
    if (!email || !stop_id) {
      return res.status(400).json({ error: 'email and stop_id required' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $addToSet: { favorites: stop_id } },
      { upsert: true, new: true }
    );

    res.json({ ok: true, favorites: user.favorites || [] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// remove a favorite stop_id
router.post('/favorites/remove', async (req, res) => {
  try {
    const { email, stop_id } = req.body;
    if (!email || !stop_id) {
      return res.status(400).json({ error: 'email and stop_id required' });
    }

    const user = await User.findOneAndUpdate(
      { email },
      { $pull: { favorites: stop_id } },
      { new: true }
    );

    const favs = user && Array.isArray(user.favorites) ? user.favorites : [];
    res.json({ ok: true, favorites: favs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
