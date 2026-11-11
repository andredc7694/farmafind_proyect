import type { Express } from 'express';

export function registerHealth(app: Express) {
  app.get('/health', (_request, response) => {
    response.set('Cache-Control', 'no-store');
    response.status(200).json({ service: 'farmafind-notifications', status: 'ok', mode: 'bootstrap' });
  });
}
