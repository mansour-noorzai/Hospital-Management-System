import { fetchSecrets } from './config/secrets';
import { connectDB } from './db/mongoose';
import { connectRedis } from './db/redis';
import { connectSocketAdapter } from './socket';

let initialization: Promise<void> | undefined;

/** Reuse connections across concurrent requests and warm function invocations. */
export function initializeRuntime(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const secrets = await fetchSecrets();
      Object.assign(process.env, secrets);
      await connectDB();
      await connectRedis();
      await connectSocketAdapter();
    })().catch(error => {
      initialization = undefined;
      throw error;
    });
  }
  return initialization;
}
