import mongoose from 'mongoose';
import { logger } from '../middleware/requestLogger';

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;
let connectionPromise: Promise<void> | undefined;

export async function connectDB(uri?: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connectionPromise) connectionPromise = openConnection(uri).finally(() => { connectionPromise = undefined; });
  return connectionPromise;
}

async function openConnection(uri?: string): Promise<void> {
  if (process.env.NODE_ENV === 'production' && !(uri || process.env.MONGODB_URI)) throw new Error('MONGODB_URI is required');
  const mongoUri = uri || process.env.MONGODB_URI || 'mongodb://localhost:27017/hms';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
        minPoolSize: 0,
        maxIdleTimeMS: 60000,
        autoIndex: process.env.NODE_ENV !== 'production',
      });
      logger.info('MongoDB connected');
      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      logger.warn(`MongoDB connection attempt ${attempt} failed — retrying in ${RETRY_DELAY_MS}ms`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  connectionPromise = undefined;
}
