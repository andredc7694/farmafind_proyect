import express from 'express';
import { registerHealth } from './bootstrap/health.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  registerHealth(app);
  return app;
}
