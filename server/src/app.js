const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const sequelize = require('./config/database');
const models = require('./models');
const seed = require('./seeders/seed');

const app = express();

// ============
// Routes
// ============
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const accountCodeRequestsRoutes = require('./routes/accountCodeRequests');
const lookupsRoutes = require('./routes/lookups');
const venueRoutes = require('./routes/venues');
const eventRoutes = require('./routes/events');
const attachmentRoutes = require('./routes/attachments');
const notificationsRoutes = require('./routes/notifications');
const conflictRoutes = require('./routes/conflict');

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'TRACK v2 API is running' });
});

// ============
// Mount routes
// ============
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account-code-requests', accountCodeRequestsRoutes);
app.use('/api/lookups', lookupsRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/events', conflictRoutes);

// Serve uploaded files statically
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

// Serve public assets (holidays.json, etc.)
const publicPath = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
app.use('/data', express.static(publicPath));

// ============
// Database sync & seed (when RUN_SYNC=true)
// ============
async function initializeDatabase() {
  try {
    await sequelize.authenticate();
    console.log('Connected to TiDB Cloud');

    if (process.env.RUN_SYNC === 'true') {
      await sequelize.sync({ force: true });
      console.log('Tables synced');
      await seed();
      console.log('Seed complete');
    } else {
      await models.Location.sync();
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

initializeDatabase();

module.exports = app;