import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('contrato API /health', () => {
  it('responde exactamente con identidad técnica propia', async () => {
    const r = await request(createApp()).get('/health').expect(200).expect('Content-Type', /application\/json/).expect('Cache-Control', 'no-store');
    expect(r.body).toEqual({ service: 'farmafind-api', status: 'ok', mode: 'bootstrap' });
  });
  it('no expone rutas de negocio ni métodos no definidos', async () => {
    await request(createApp()).get('/reservas').expect(404);
    await request(createApp()).post('/health').expect(404);
  });
});
