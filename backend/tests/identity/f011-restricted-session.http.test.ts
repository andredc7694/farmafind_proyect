import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createRestrictedSessionGuard, restrictedSessionAllowlist } from '../../src/modules/usuarios/presentation/auth-middleware.js';
import type { SessionRestriction } from '../../src/modules/usuarios/presentation/auth-middleware.js';

const options = { allowedOrigin: 'http://127.0.0.1:5173', csrfKey: Buffer.alloc(32, 7), cookieSecure: false };
const secrets = { cambio: 'a'.repeat(64), mfa: 'b'.repeat(64), libre: 'c'.repeat(64), roto: 'd'.repeat(64) };
const cookie = (secret: string) => `ff-session-local=${secret}`;

function build() {
  const app = express();
  app.use('/api/v1', createRestrictedSessionGuard({ ...options, prefix: '/api/v1',
    async restrictionOf(secret): Promise<SessionRestriction | null> {
      if (secret === secrets.cambio) return 'CAMBIO_CLAVE';
      if (secret === secrets.mfa) return 'MFA_PENDIENTE';
      if (secret === secrets.roto) throw new Error('base no disponible');
      return null;
    } }));
  app.all('/api/v1/*path', (_request, response) => { response.status(200).json({ ok: true }); });
  return app;
}

describe('F01.1 sesión restringida (middleware HTTP)', () => {
  it('deja pasar solicitudes sin cookie de sesión y sesiones sin restricción', async () => {
    const app = build();
    await request(app).get('/api/v1/pharmacies/x/inventory').expect(200);
    await request(app).get('/api/v1/pharmacies/x/inventory').set('Cookie', cookie(secrets.libre)).expect(200);
  });

  it('una sesión con cambio de clave pendiente solo alcanza sus rutas permitidas', async () => {
    const app = build();
    for (const [method, route] of [['get', '/auth/csrf'], ['get', '/auth/session'], ['post', '/auth/logout'], ['post', '/auth/password/change-temporary']] as const) {
      await request(app)[method](`/api/v1${route}`).set('Cookie', cookie(secrets.cambio)).expect(200);
    }
    await request(app).post('/api/v1/auth/mfa/verify').set('Cookie', cookie(secrets.cambio)).expect(403)
      .expect(response => expect(response.body.code).toBe('SESSION_RESTRICTED'));
  });

  it('una sesión con segundo factor pendiente solo alcanza sus rutas permitidas', async () => {
    const app = build();
    await request(app).post('/api/v1/auth/mfa/verify').set('Cookie', cookie(secrets.mfa)).expect(200);
    await request(app).post('/api/v1/auth/password/change-temporary').set('Cookie', cookie(secrets.mfa)).expect(403);
  });

  it.each([
    ['get', '/pharmacies/x/inventory'], ['post', '/pharmacies/x/staff'], ['get', '/platform/role-assignments'],
    ['post', '/me/invitations/1/accept'], ['put', '/me/active-pharmacy'], ['get', '/me/memberships'],
    ['delete', '/auth/session'], ['get', '/auth/logout'], ['post', '/auth/session'],
  ] as const)('deniega %s %s a una sesión restringida', async (method, route) => {
    const app = build();
    for (const secret of [secrets.cambio, secrets.mfa]) {
      const response = await request(app)[method](`/api/v1${route}`).set('Cookie', cookie(secret));
      expect(response.status).toBe(403);
      expect(response.headers['cache-control']).toBe('no-store');
    }
  });

  it('ignora parámetros de consulta al comparar la ruta (no permiten saltarse la lista)', async () => {
    const app = build();
    await request(app).get('/api/v1/auth/session?x=1').set('Cookie', cookie(secrets.cambio)).expect(200);
    await request(app).get('/api/v1/pharmacies/x/inventory?/auth/session').set('Cookie', cookie(secrets.cambio)).expect(403);
  });

  it('falla cerrado cuando no puede consultar la sesión', async () => {
    await request(build()).get('/api/v1/auth/session').set('Cookie', cookie(secrets.roto)).expect(503);
  });

  it('una cookie con formato inválido se trata como ausente (sin consulta)', async () => {
    await request(build()).get('/api/v1/pharmacies/x/inventory').set('Cookie', 'ff-session-local=no-es-hex').expect(200);
  });

  it('la lista permitida coincide con contracts/security.md §6', () => {
    expect(restrictedSessionAllowlist.CAMBIO_CLAVE).toEqual(['GET /auth/csrf', 'GET /auth/session', 'POST /auth/logout', 'POST /auth/password/change-temporary']);
    expect(restrictedSessionAllowlist.MFA_PENDIENTE).toEqual(['GET /auth/csrf', 'GET /auth/session', 'POST /auth/logout', 'POST /auth/mfa/verify']);
  });
});
