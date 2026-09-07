import http from 'node:http';
import { app } from './app';
import { initializeRuntime } from './runtime';
import { initSocket } from './socket';
import { logger } from './middleware/requestLogger';

const server = http.createServer((req, res) => {
  void initializeRuntime().then(() => app(req, res)).catch(() => {
    logger.error('Runtime initialization failed; check database and secret configuration');
    res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '30' });
    res.end(JSON.stringify({ success: false, error: { code: 'SERVICE_UNAVAILABLE', message: 'Service is temporarily unavailable.' } }));
  });
});

// Socket authentication waits for the same initialization promise as HTTP requests.
initSocket(server, undefined, initializeRuntime);

export default server;
