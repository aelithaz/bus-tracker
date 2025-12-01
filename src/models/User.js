const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  fcmTokens: { type: [String], default: [] },
  createdAt: { type: Date, default: () => new Date() }
});

module.exports = mongoose.model('User', userSchema);
