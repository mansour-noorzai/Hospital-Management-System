import mongoose from 'mongoose';
import { createHash } from 'crypto';

export const SOCKET_EVENTS = 'socket_events';
const RATE_LIMITS = 'request_limits';

export async function prepareSharedState(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database unavailable');
  await db.collection(RATE_LIMITS).createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection(SOCKET_EVENTS).createIndex({ createdAt: 1 }, { expireAfterSeconds: 300 });
}

/** Indexed upsert: one atomic counter shared by all server instances. */
export async function incrementRequestCount(identifier: string, windowSeconds: number, now = Date.now()): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database unavailable');
  const windowMs = windowSeconds * 1000;
  const bucket = Math.floor(now / windowMs);
  const id = `${createHash('sha256').update(identifier).digest('hex')}:${bucket}`;
  const counters = db.collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS);
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } };
  let result;
  try {
    result = await counters.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: 'after' });
  } catch (error) {
    // A simultaneous first insert can lose the unique-key race. Count it once.
    if ((error as { code?: number }).code !== 11000) throw error;
    result = await counters.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { returnDocument: 'after' });
  }
  if (!result) throw new Error('Rate limit counter unavailable');
  return result.count;
}
