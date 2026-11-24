import express from 'express';
import type { RequestHandler, Router } from 'express';
import { registerHealth } from './bootstrap/health.js';

export function createApp(identityRouter?: Router, membershipRouter?: Router, geolocationRouter?: Router,
  /** F01.1: guardia de sesión restringida; debe ir antes de cualquier ruta. */
  restrictedSessionGuard?: RequestHandler) {
  const app = express();
  app.disable('x-powered-by');
  registerHealth(app);
  if (restrictedSessionGuard) app.use('/api/v1', restrictedSessionGuard);
  if (identityRouter) app.use('/api/v1', identityRouter);
  if (membershipRouter) app.use('/api/v1', membershipRouter);
  if (geolocationRouter) app.use('/api/v1', geolocationRouter);
  return app;
}
