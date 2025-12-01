// Example script to register an FCM token for an email and create a subscription
const axios = require('axios');

async function main() {
  const base = process.env.BUS_TRACKER_BASE || 'http://localhost:3000';
  const email = process.env.TEST_EMAIL || 'tester@example.com';
  const fcmToken = process.env.TEST_FCM_TOKEN || 'fake-token-for-dev';
  const stop_id = process.env.TEST_STOP || 'it:1';
  const trip_id = process.env.TEST_TRIP || 'example-trip-id';
  const notifyBeforeMinutes = process.env.TEST_NOTIFY_MINUTES !== undefined ? Number(process.env.TEST_NOTIFY_MINUTES) : undefined;

  console.log('registering token', email, fcmToken);
  await axios.post(`${base}/api/users/register-token`, { email, fcmToken });

  const subsBody = { email, stop_id, trip_id };
  if (notifyBeforeMinutes !== undefined) subsBody.notifyBeforeMinutes = notifyBeforeMinutes;

  console.log('creating subscription', subsBody);
  const resp = await axios.post(`${base}/api/subscriptions`, subsBody);
  console.log('subscription created', resp.data);
}

main().catch(err => {
  console.error(err.response ? err.response.data : err.message);
  process.exit(1);
});
