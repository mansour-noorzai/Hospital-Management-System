import Redis from "ioredis";
import { logger } from "../middleware/requestLogger";

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    throw new Error("Redis not initialized — call connectRedis() first");
  }
  return redisClient;
}

export async function connectRedis(url?: string): Promise<Redis | null> {
  const redisUrl = url || process.env.REDIS_URL || "redis://localhost:6379";

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      enableReadyCheck: true,
      retryStrategy: () => null,
    });

    // Attach the error listener before the first connection attempt so an
    // optional/offline Redis instance never produces an unhandled event.
    redisClient.on("error", (err) => logger.warn("Redis connection error", { error: err.message }));
    redisClient.on("reconnecting", () => logger.warn("Redis reconnecting..."));

    await redisClient.connect();
    logger.info("Redis connected");

    return redisClient;
  } catch (err) {
    redisClient?.disconnect();
    redisClient = null;
    logger.warn("Redis unavailable — continuing without Redis", {
      error: (err as Error).message,
    });
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
