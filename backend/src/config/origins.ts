export function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  const configured = (process.env.CORS_ORIGINS || '').split(',');
  const origins = [
    ...configured,
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ].filter((value): value is string => !!value).map(value => value.trim().replace(/\/$/, ''));
  if (process.env.NODE_ENV !== 'production') origins.push('http://localhost:5173', 'http://127.0.0.1:5173');
  return origins.includes(origin);
}
