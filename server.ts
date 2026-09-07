// Vercel captures this HTTP server and routes both HTTP and WebSocket traffic to it.
// Native server routing preserves the application's /api/v1 and /socket.io paths.
import express from 'express';
import { createServer } from 'node:http';
import { app } from './backend/src/app';
import { initializeRuntime } from './backend/src/runtime';
import { initSocket } from './backend/src/socket';

const gateway = express();
gateway.disable('x-powered-by');
gateway.use(async (_req, res, next) => {
  try {
    await initializeRuntime();
    next();
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '30');
    res.status(503).json({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is temporarily unavailable.' } });
  }
});
gateway.use(app);
const server = createServer(gateway);
initSocket(server, undefined, initializeRuntime);

server.listen(Number(process.env.PORT || 3000));

export default server;
