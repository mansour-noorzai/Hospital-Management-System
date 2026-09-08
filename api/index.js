// Vercel invokes this Express application as a serverless function.
const express = require('express');
const { app } = require('../backend/dist/app');
const { initializeRuntime } = require('../backend/dist/runtime');

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

module.exports = gateway;
