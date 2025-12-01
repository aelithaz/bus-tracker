const mongoose = require('mongoose');

async function connect(uri) {
  const mongoUri = uri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bus-tracker';
  await mongoose.connect(mongoUri, {
    // defaults are fine for modern mongoose; keep unified topology
  });
  console.log('✔️  Connected to MongoDB:', mongoUri);
}

module.exports = { connect };
