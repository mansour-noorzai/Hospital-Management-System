import { fetchSecrets } from '../config/secrets';
import { connectDB, disconnectDB } from '../db/mongoose';
import { connectRedis, disconnectRedis } from '../db/redis';
import mongoose from 'mongoose';
import { seedDemo } from './seed-demo';
import '../routes';

async function prepare() {
  Object.assign(process.env, await fetchSecrets());
  if (process.env.VERCEL_ENV === 'preview' && process.env.ALLOW_PREVIEW_DATABASE !== 'true') {
    throw new Error('Preview database access requires ALLOW_PREVIEW_DATABASE=true and a separate preview database.');
  }
  await connectDB();
  await connectRedis();
  // Create missing indexes; never drop collections, existing indexes, or records.
  for (const model of Object.values(mongoose.models)) await model.createIndexes();
  if (process.env.DEMO_MODE === 'true') {
    await seedDemo();
  }
  console.log('Deployment database preparation completed.');
}

prepare().catch(() => {
  // Connection errors can contain credentials; keep deployment logs secret-free.
  console.error('Deployment preparation failed. Verify environment variables, database network access and indexes.');
  process.exitCode = 1;
}).finally(async () => {
  await disconnectRedis();
  await disconnectDB();
});
