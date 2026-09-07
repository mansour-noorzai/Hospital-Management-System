import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { getRedisClient } from './db/redis';
import { isAllowedOrigin } from './config/origins';
import { errorHandler, ForbiddenError } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { rateLimiter } from './middleware/rateLimiter';
import { router } from './routes';
import { auditMutations } from './middleware/auditLog';
import { maintenanceHandler } from './jobs/maintenance';

const app = express();
app.disable('x-powered-by');
if (process.env.VERCEL) app.set('trust proxy', 1);
app.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });

// Security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS — allow origins from env.CORS_ORIGINS (comma-separated)
app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new ForbiddenError(`Origin ${origin} is not allowed by CORS`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(requestLogger);
app.use(rateLimiter);

// Health check (no auth)
app.get('/api/v1/health', async (_req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) throw new Error('Database unavailable');
    await mongoose.connection.db!.admin().ping();
    await getRedisClient().ping();
    res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
  } catch {
    res.status(503).json({ success: false, error: { code: 'NOT_READY', message: 'Service is temporarily unavailable.' } });
  }
});

// API routes
app.get('/api/v1/internal/maintenance', maintenanceHandler);
app.use('/api/v1', auditMutations, router);

app.use(errorHandler);

export { app };
