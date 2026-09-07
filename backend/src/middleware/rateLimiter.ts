import { Request, Response, NextFunction } from 'express';
import { getRedisClient } from '../db/redis';
import { usesRedis } from '../config/stateBackend';
import { incrementRequestCount } from '../db/sharedState';
import { logger } from './requestLogger';
import { errorResponse } from '../types/api';

const WINDOW_SECONDS = 60;
const MAX_REQUESTS = 100;

// Atomic Lua script: INCR and EXPIRE in a single round-trip, eliminating the race condition
// where a key could be incremented but never expire if the server crashes between INCR and EXPIRE.
const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return current
`;

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const identifier = req.ip ?? 'unknown';
    const key = `ratelimit:${identifier}`;

    const current = usesRedis()
      ? await getRedisClient().eval(RATE_LIMIT_LUA, 1, key, String(WINDOW_SECONDS)) as number
      : await incrementRequestCount(identifier, WINDOW_SECONDS);

    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - current));

    if (current > MAX_REQUESTS) {
      res.setHeader('Retry-After', WINDOW_SECONDS);
      res.status(429).json(errorResponse('RATE_LIMIT_EXCEEDED', 'Too many requests — please try again later'));
      return;
    }

    next();
  } catch (err) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).json(errorResponse('SERVICE_UNAVAILABLE', 'Service is temporarily unavailable.'));
      return;
    }
    // Local development can run without shared infrastructure.
    logger.warn('Rate limiter store unavailable in local development');
    next();
  }
}
