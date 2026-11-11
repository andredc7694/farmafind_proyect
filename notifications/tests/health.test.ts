import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('contrato Notificaciones /health', () => {
  it('identifica el proceso independiente sin mensajes o eventos', async () => {
    const r = await request(createApp()).get('/health').expect(200).expect('Content-Type', /application\/json/).expect('Cache-Control', 'no-store');
    expect(r.body).toEqual({ service: 'farmafind-notifications', status: 'ok', mode: 'bootstrap' });
  });
  it('no acepta mensajes ni eventos de negocio', async () => {
    await request(createApp()).post('/events').expect(404);
    await request(createApp()).get('/reservas').expect(404);
  });
});
