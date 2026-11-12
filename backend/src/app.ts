import express from 'express';
import type { Router } from 'express';
import { registerHealth } from './bootstrap/health.js';

export function createApp(identityRouter?: Router, membershipRouter?: Router) {
  const app = express();
  app.disable('x-powered-by');
  registerHealth(app);
  if (identityRouter) app.use('/api/v1', identityRouter);
  if (membershipRouter) app.use('/api/v1', membershipRouter);
  return app;
}
