const express = require('express');
const User = require('../models/User');

const router = express.Router();

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
