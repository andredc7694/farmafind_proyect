import express from 'express';
import { registerHealth } from './bootstrap/health.js';
import type { ProcessEvent } from './events/process-event.js';
import { createEventsRouter } from './events/router.js';
import type {ApplicationEventRepository} from './events/application-repository.js';
import {createApplicationEventsRouter} from './events/application-router.js';

export function createApp(events?: { processor: ProcessEvent; secret: string; clock?: { now(): Date };
  applicationRepository?:ApplicationEventRepository }) {
  const app = express();
  app.disable('x-powered-by');
  registerHealth(app);
  if (events) app.use(createEventsRouter(events.processor, events.secret, events.clock));
  if(events?.applicationRepository)
    app.use(createApplicationEventsRouter(events.applicationRepository,events.secret,events.clock));
  app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (error instanceof Error && 'type' in error && error.type === 'entity.too.large') return response.status(413).json({ error: 'Cuerpo demasiado grande' });
    next(error);
  });
  return app;
}
