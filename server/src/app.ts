import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import fs from 'fs';
import path from 'path';
import sequelize from './config/database';
import models from './models';
import seed from './seeders/seed';

// ─── Route imports ───
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import accountCodeRequestsRoutes from './routes/accountCodeRequests';
import lookupsRoutes from './routes/lookups';
import venueRoutes from './routes/venues';
import eventRoutes from './routes/events';
import attachmentRoutes from './routes/attachments';
import notificationsRoutes from './routes/notifications';
import conflictRoutes from './routes/conflict';

const app: Express = express();

// ─── Middleware ───
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// ─── Health check ───
app.get('/', (req: Request, res: Response) => {
  res.json({ message: 'TRACK v2 API is running' });
});

// ─── Routes ───
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/account-code-requests', accountCodeRequestsRoutes);
app.use('/api/lookups', lookupsRoutes);
app.use('/api/venues', venueRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/events', conflictRoutes);

// ─── Static files ───
const uploadsPath = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsPath)) {
  fs.mkdirSync(uploadsPath, { recursive: true });
}
app.use('/uploads', express.static(uploadsPath));

const publicPath = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicPath)) {
  fs.mkdirSync(publicPath, { recursive: true });
}
app.use('/data', express.static(publicPath));

// ─── Database initialization ───
async function initializeDatabase(): Promise<void> {
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

// ─── Error handling middleware ───
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ ok: false, message: 'Internal server error' });
});

export default app;