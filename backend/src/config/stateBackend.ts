/** MongoDB shares rate limits and live events without a separate paid service. */
export function usesRedis(): boolean {
  const backend = process.env.STATE_BACKEND || 'mongodb';
  if (backend !== 'mongodb' && backend !== 'redis') throw new Error('STATE_BACKEND must be mongodb or redis');
  return backend === 'redis';
}
