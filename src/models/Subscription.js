const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  email: { type: String, required: true, index: true },
  stop_id: { type: String, required: true },
  trip_id: { type: String, required: true },
  // number of minutes before arrival to notify this subscription's owner
  notifyBeforeMinutes: { type: Number, default: 5, min: 0 },
  // track the most recent scheduled arrival we notified about (YYYYMMDD_HH:mm:ss)
  lastNotifiedFor: { type: String, default: null },
  createdAt: { type: Date, default: () => new Date() }
});

module.exports = mongoose.model('Subscription', subscriptionSchema);
