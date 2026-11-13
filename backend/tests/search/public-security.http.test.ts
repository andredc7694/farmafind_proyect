import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createPublicSearchRouter } from '../../src/modules/busqueda/presentation/public-search-router.js';
import { InMemoryPublicRateLimit } from '../../src/modules/busqueda/presentation/public-rate-limit.js';

describe('seguridad HTTP pública F03',()=>{
  it('limita abuso sin eco de parámetros privados',async()=>{
    const search={execute:vi.fn().mockResolvedValue({})}; const app=express();
    app.use('/api/v1',createPublicSearchRouter(search as never,new InMemoryPublicRateLimit(1,60_000)));
    await request(app).get('/api/v1/busquedas?q=producto').expect(200);
    const limited=await request(app).get('/api/v1/busquedas?q=secreto-privado').expect(429);
    expect(JSON.stringify(limited.body)).not.toContain('secreto-privado'); expect(limited.headers['retry-after']).toBeDefined();
  });
  it('falla de fuente devuelve 503 genérico sin SQL',async()=>{
    const app=express(); app.use('/api/v1',createPublicSearchRouter({execute:vi.fn().mockRejectedValue(new Error('SELECT password_hash'))} as never));
    const response=await request(app).get('/api/v1/busquedas?q=producto').expect(503);
    expect(JSON.stringify(response.body)).not.toContain('password_hash');
  });
});
