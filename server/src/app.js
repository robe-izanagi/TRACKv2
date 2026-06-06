const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const sequelize = require('./config/database');
const models = require('./models');   // still need to load models
const seed = require('./seeders/seed');

const app = express();

// ============
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const accountCodeRequestsRoutes = require('./routes/accountCodeRequests');
const lookupsRoutes = require('./routes/lookups');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'TRACK v2 API is running' });
});

// ============
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account-code-requests', accountCodeRequestsRoutes);
app.use('/api/lookups', lookupsRoutes);

// Only sync & seed when RUN_SYNC=true
if (process.env.RUN_SYNC === 'true') {
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Connected to TiDB Cloud');
      return sequelize.sync(/* use { force: true } only if you need to reset */);
    })
    .then(() => {
      console.log('✅ Tables synced');
      return seed();
    })
    .then(() => console.log('✅ Seed complete'))
    .catch(err => console.error('❌ Error:', err));
} else {
  // Just connect, no schema changes
  sequelize.authenticate()
    .then(() => console.log('✅ Connected to TiDB Cloud (no sync)'))
    .catch(err => console.error('❌ DB Connection Error:', err));
}

module.exports = app;