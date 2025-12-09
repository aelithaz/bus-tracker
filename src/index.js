require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const { connect } = require('./config/db');
const usersRouter = require('./routes/users');
const subsRouter = require('./routes/subscriptions');
const mtdRouter = require('./routes/mtd');
const admin = require('firebase-admin');
const makePoller = require('./worker/poller');

const app = express();
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/users', usersRouter);
app.use('/api/subscriptions', subsRouter);
app.use('/api/mtd', mtdRouter);

app.get('/health', (req, res) => res.send('bus-tracker backend running'));

const PORT = process.env.PORT || 3000;

async function init() {
  await connect(process.env.MONGO_URI);
  // initialize firebase-admin
  let firebaseCred;
  if (process.env.FCM_SERVICE_ACCOUNT_PATH) {
    firebaseCred = JSON.parse(fs.readFileSync(process.env.FCM_SERVICE_ACCOUNT_PATH, 'utf8'));
  } else if (process.env.FCM_SERVICE_ACCOUNT) {
    firebaseCred = JSON.parse(process.env.FCM_SERVICE_ACCOUNT);
  }

  if (firebaseCred) {
    admin.initializeApp({ credential: admin.credential.cert(firebaseCred) });
    console.log('✔️  Firebase admin initialized');
  } else {
    console.warn('⚠️  No Firebase service account configured — FCM not enabled');
  }

  const server = app.listen(PORT, () => console.log(`Server listening on ${PORT}`));

  // start poller only if we have both key and firebase
  if (process.env.MTD_API_KEY && admin.apps.length) {
    const poller = makePoller({ mtdKey: process.env.MTD_API_KEY, firebaseAdmin: admin, intervalMs: Number(process.env.POLL_INTERVAL_MS) || 60_000, notifyWindowMinutes: Number(process.env.NOTIFY_WINDOW_MINUTES) || 5 });
    poller.start();
    // gracefully stop on SIGINT
    process.on('SIGINT', async () => {
      console.log('shutting down...');
      poller.stop();
      server.close(() => process.exit(0));
    });
  } else {
    console.warn('⚠️  Poller not started — ensure MTD_API_KEY and Firebase service account are configured');
  }
}

init().catch(err => {
  console.error(err);
  process.exit(1);
});
