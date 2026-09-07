import Redis from "ioredis";
import { usesRedis } from '../config/stateBackend';
import { logger } from "../middleware/requestLogger";

let redisClient: Redis | null = null;
let connecting: Promise<Redis | null> | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error("Redis not initialized — call connectRedis() first");
  }
  return redisClient;
}

export async function connectRedis(url?: string): Promise<Redis | null> {
  if (!usesRedis()) return null;
  if (redisClient?.status === 'ready') return redisClient;
  if (!connecting) connecting = openRedis(url).finally(() => { connecting = null; });
  return connecting;
}

async function openRedis(url?: string): Promise<Redis | null> {
  const redisUrl = url || process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: (attempt) => Math.min(attempt * 200, 2000),
    });

    // Attach the error listener before the first connection attempt so an
    // optional/offline Redis instance never produces an unhandled event.
    redisClient.on("error", () => logger.warn("Redis connection error"));
    redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));

    await redisClient.connect();
    logger.info("Redis connected");

    return redisClient;
  } catch (err) {
    redisClient?.disconnect();
    redisClient = null;
    if (process.env.NODE_ENV === 'production') throw new Error('Redis is required for production rate limits and live updates');
    logger.warn("Redis unavailable — continuing without Redis");
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
