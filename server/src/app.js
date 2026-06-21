const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const sequelize = require('./config/database');
const models = require('./models');
const seed = require('./seeders/seed');
const path = require('path');

const app = express();

// ============
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const accountCodeRequestsRoutes = require('./routes/accountCodeRequests');
const lookupsRoutes = require('./routes/lookups');
const venueRoutes = require('./routes/venues');
const eventRoutes = require('./routes/events');
const attachmentRoutes = require('./routes/attachments');

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
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/api/attachments', attachmentRoutes);

// Only sync & seed when RUN_SYNC=true
if (process.env.RUN_SYNC === 'true') {
  sequelize.authenticate()
    .then(() => {
      console.log('Connected to TiDB Cloud');
      return sequelize.sync({ force: true });
    })
    .then(() => {
      console.log('Tables synced');
      return seed();
    })
    .then(() => console.log('Seed complete'))
    .catch(err => console.error('Error:', err));
}

module.exports = app;