# Bus Tracker — backend

This backend lets you:

- register user FCM tokens tied to an email
- create subscriptions for an email at a stop_id + trip_id
- poll the MTD getstoptimesbystop API and send FCM push when the subscribed trip is arriving soon

Quick start

1. Copy `.env.example` to `.env` and configure values (MTD_API_KEY and either FCM_SERVICE_ACCOUNT_PATH or FCM_SERVICE_ACCOUNT).
2. Ensure MongoDB is running locally or point `MONGO_URI` to a running Mongo server.
3. Install dependencies and start:

```bash
npm install
npm run start
```

API endpoints

- POST /api/users/register-token  { email, fcmToken }
- GET /api/users/tokens/:email
- POST /api/subscriptions { email, stop_id, trip_id }
- POST /api/subscriptions { email, stop_id, trip_id, notifyBeforeMinutes }
- GET /api/subscriptions
- GET /api/subscriptions/by-email/:email

Notes

- The poller will read `MTD_API_KEY` and query `getstoptimesbystop` for subscribed stops. It only sends a notification once per scheduled arrival (de-dup key is date+arrival_time).
- You can change `POLL_INTERVAL_MS` and `NOTIFY_WINDOW_MINUTES` via environment variables.

- When creating a subscription you can set `notifyBeforeMinutes` (number of minutes before scheduled arrival when you'd like to be notified). If omitted the subscription will use a default of 5 minutes unless overridden by the `NOTIFY_WINDOW_MINUTES` env.

Example run

1. Start the server: `npm start`
2. Run the example script (after setting env or using defaults):

```bash
node scripts/register_and_subscribe.js
```

This will register an FCM token for a test email and create a subscription — it's useful for quick manual tests.

You can set the notification time for the sample run by exporting `TEST_NOTIFY_MINUTES`, e.g.:

```bash
TEST_NOTIFY_MINUTES=10 node scripts/register_and_subscribe.js
```
