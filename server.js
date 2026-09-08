// Vercel invokes this Express application as a serverless function.
const express = require('express');
const path = require('path');
const { app } = require('./backend/dist/app');
const { initializeRuntime } = require('./backend/dist/runtime');

const gateway = express();
const publicDirectory = path.join(__dirname, 'public');
gateway.disable('x-powered-by');

// Serve the compiled SPA without starting the database runtime. Fingerprinted
// assets are immutable; index.html is always revalidated on a new deployment.
gateway.use('/assets', express.static(path.join(publicDirectory, 'assets'), {
  immutable: true,
  maxAge: '1y',
}));
gateway.use(express.static(publicDirectory, {
  index: 'index.html',
  maxAge: 0,
}));
gateway.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/socket.io/')) {
    return res.sendFile(path.join(publicDirectory, 'index.html'));
  }
  next();
});

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
module.exports = gateway;
