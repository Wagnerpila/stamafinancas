import express from 'express';
import cors from 'cors';
import path from 'node:path';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import entitiesRoutes from './routes/entities.routes.js';
import subscriptionPlansRoutes from './routes/subscriptionPlans.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import aiRoutes from './routes/ai.routes.js';
import whatsappRoutes from './routes/whatsapp.routes.js';
import miscRoutes from './routes/misc.routes.js';
import { errorHandler } from './middleware/errorHandler.js';

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

export function createApp() {
  const app = express();

  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use('/uploads', express.static(UPLOAD_DIR));

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/entities', entitiesRoutes);
  app.use('/api/subscription-plans', subscriptionPlansRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api', miscRoutes);

  app.use('/api', (req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use(errorHandler);

  // Frontend (build do Vite), servido pelo mesmo processo/porta em produção.
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'), (err) => {
      if (err) next(err);
    });
  });

  return app;
}
