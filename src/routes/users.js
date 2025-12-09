const express = require('express');
const User = require('../models/User');
const bcrypt = require('bcryptjs');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    let user = await User.findOne({ email });
    if (user && user.passwordHash) return res.status(409).json({ error: 'user-exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    if (!user) user = new User({ email, passwordHash });
    else user.passwordHash = passwordHash;

    await user.save();
    res.json({ ok: true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });

    const user = await User.findOne({ email });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'invalid' });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid' });

    res.json({ ok: true, email });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register or add an FCM token for an email
router.post('/register-token', async (req, res) => {
  try {
    const { email, fcmToken } = req.body;
    if (!email || !fcmToken) return res.status(400).json({ error: 'email and fcmToken required' });

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

module.exports = router;
