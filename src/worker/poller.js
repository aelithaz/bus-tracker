const axios = require('axios');
const Subscription = require('../models/Subscription');
const User = require('../models/User');

function parseTimeStringToDate(today, timeStr) {
  // timeStr is HH:mm:ss (MTD uses 30-hour clock sometimes). We'll normalize simple cases.
  let [h, m, s] = timeStr.split(':').map(Number);
  // if hours >= 24, treat as next day
  let d = new Date(today);
  if (h >= 24) {
    h = h - 24;
    d.setDate(d.getDate() + 1);
  }
  d.setHours(h, m, s || 0, 0);
  return d;
}

module.exports = function makePoller({ mtdKey, firebaseAdmin, intervalMs = 60_000, notifyWindowMinutes = 5 }) {
  let running = false;

  async function pollOnce() {
    try {
      const subs = await Subscription.find({}).limit(1000);
      if (!subs.length) return;

      const groupsByStop = subs.reduce((acc, s) => {
        acc[s.stop_id] = acc[s.stop_id] || [];
        acc[s.stop_id].push(s);
        return acc;
      }, {});

      const today = new Date();
      const dateParam = `${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}`;

      await Promise.all(Object.keys(groupsByStop).map(async (stopId) => {
        try {
          const url = `https://developer.mtd.org/api/2.2/json/getstoptimesbystop?key=${encodeURIComponent(mtdKey)}&stop_id=${encodeURIComponent(stopId)}&date=${dateParam}`;
          const resp = await axios.get(url, { timeout: 10000 });
          const data = resp.data;
          const stopTimes = data.stop_times || [];

          const subsForStop = groupsByStop[stopId];

          for (const sub of subsForStop) {
            const matching = stopTimes.filter(st => st.trip && st.trip.trip_id === sub.trip_id);
            for (const st of matching) {
              const arrival = st.arrival_time;
              const arrivalDate = parseTimeStringToDate(today, arrival);
              const now = new Date();
              const diffMs = arrivalDate - now;
              const diffMin = diffMs / (60*1000);

              // only notify for upcoming arrivals within the subscription's window
              const windowMinutes = (typeof sub.notifyBeforeMinutes === 'number' && sub.notifyBeforeMinutes >= 0) ? sub.notifyBeforeMinutes : notifyWindowMinutes;
              if (diffMin >= 0 && diffMin <= windowMinutes) {
                const key = `${dateParam}_${arrival}`;
                if (sub.lastNotifiedFor !== key) {
                  // fetch user's tokens
                  const user = await User.findOne({ email: sub.email });
                  if (user && user.fcmTokens && user.fcmTokens.length) {
                    const payload = {
                      notification: {
                        title: 'Bus arriving soon',
                        body: `Your trip ${sub.trip_id} is arriving at stop ${sub.stop_id} at ${arrival} (${Math.round(diffMin)} min)`
                      },
                      data: { trip_id: sub.trip_id, stop_id: sub.stop_id }
                    };

                    try {
                      await firebaseAdmin.messaging().sendToDevice(user.fcmTokens, payload);
                      console.log(`Notified ${sub.email} for ${sub.trip_id} @ ${sub.stop_id} (${arrival})`);
                      sub.lastNotifiedFor = key;
                      await sub.save();
                    } catch (notifyErr) {
                      console.error('FCM send error', notifyErr.message || notifyErr);
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('poller stop error', stopId, err.message || err);
        }
      }));

    } catch (err) {
      console.error('error in pollOnce', err.message || err);
    }
  }

  let intervalHandle;

  return {
    start() {
      if (!mtdKey) throw new Error('MTD API key required');
      if (!firebaseAdmin) throw new Error('firebaseAdmin instance required');
      if (running) return;
      running = true;
      // initial run
      pollOnce().catch(console.error);
      intervalHandle = setInterval(pollOnce, intervalMs);
      console.log('Poller started — interval', intervalMs);
    },
    stop() {
      running = false;
      clearInterval(intervalHandle);
    }
  };
};
