import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createProfileRouter } from '../../src/modules/usuarios/presentation/profile-router.js';
import { authHttpSecurity } from '../../src/modules/usuarios/presentation/auth-middleware.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';
import { OwnSessionNotFoundError, ReauthenticationError, validateProfilePatch } from '../../src/modules/usuarios/application/profile.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const secret = 'a'.repeat(64);
const cookie = `ff-session-local=${secret}`;
const profile = { userId: 'u1', displayName: null, phone: null, avatarPreset: null, theme: 'SISTEMA', notifyReservations: true,
  notifySecurity: true, email: 'a@example.test', emailVerified: false };
const sessionId = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d';

function build(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const endpoints = {
    getProfile: vi.fn().mockResolvedValue(profile), updateProfile: vi.fn().mockResolvedValue(profile),
    requestEmailChange: vi.fn().mockResolvedValue(undefined), changePassword: vi.fn().mockResolvedValue(undefined),
    listSessions: vi.fn().mockResolvedValue([{ id: sessionId, createdAt: new Date(0), lastUsedAt: new Date(1000), current: true }]),
    revokeSession: vi.fn().mockResolvedValue(undefined), revokeOtherSessions: vi.fn().mockResolvedValue(undefined), ...overrides };
  const app = express();
  app.use('/api/v1', createProfileRouter(endpoints, options));
  return { app, endpoints };
}

async function call(app: express.Express, method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown,
  { csrf = true, withCookie = true } = {}) {
  const security = authHttpSecurity(options);
  const wrapper = express();
  wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res));
  wrapper.use(app);
  const agent = request.agent(wrapper);
  const issued = await agent.get('/csrf').set('Cookie', withCookie ? cookie : '').expect(200);
  const pending = agent[method](`/api/v1${path}`).set('Origin', origin).set('Cookie', withCookie ? cookie : '');
  if (csrf) pending.set('X-CSRF-Token', issued.body.csrfToken);
  return body === undefined ? pending : pending.send(body as object);
}

describe('F01.1 US5: rutas del perfil (router)', () => {
  it('exigen sesión; las mutaciones además CSRF, y no invocan ningún caso de uso sin ambas', async () => {
    const { app, endpoints } = build();
    const mutations: Array<['post' | 'patch' | 'delete', string, unknown]> = [['patch', '/me/profile', { theme: 'OSCURO' }],
      ['post', '/me/email/change', { newEmail: 'b@example.test', currentPassword: 'x' }],
      ['post', '/me/password', { currentPassword: 'x', newPassword: 'y' }], ['post', '/me/sessions/revoke-others', undefined],
      ['delete', `/me/sessions/${sessionId}`, undefined]];
    for (const [method, path, body] of mutations) {
      expect((await call(app, method, path, body, { csrf: false })).status, path).toBe(403);
      expect((await call(app, method, path, body, { withCookie: false })).status, path).toBe(401);
    }
    for (const path of ['/me/profile', '/me/sessions']) expect((await call(app, 'get', path, undefined, { withCookie: false })).status).toBe(401);
    expect(Object.values(endpoints).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it('lecturas con no-store; el cierre de sesión no distingue «ajena» de «inexistente» (404)', async () => {
    const { app, endpoints } = build({ revokeSession: vi.fn().mockRejectedValue(new OwnSessionNotFoundError()) });
    const read = await call(app, 'get', '/me/profile');
    expect(read.status).toBe(200); expect(read.headers['cache-control']).toBe('no-store'); expect(read.body).toEqual(profile);
    expect((await call(app, 'get', '/me/sessions')).body).toEqual([{ id: sessionId, createdAt: '1970-01-01T00:00:00.000Z',
      lastUsedAt: '1970-01-01T00:00:01.000Z', current: true }]);
    expect((await call(app, 'delete', `/me/sessions/${sessionId}`)).status).toBe(404);
    expect(endpoints.revokeSession).toHaveBeenCalledWith(secret, sessionId);
    expect((await call(app, 'post', '/me/sessions/revoke-others')).status).toBe(204);
    expect(endpoints.revokeOtherSessions).toHaveBeenCalledWith(secret);
  });

  it.each([[{}], [{ currentPassword: 'x' }], [{ currentPassword: 'x', newPassword: 'y', role: 'DUENO' }], [['x']]])(
    'el cambio de clave rechaza el cuerpo %j con 400', async body => {
      const { app, endpoints } = build();
      expect((await call(app, 'post', '/me/password', body)).status).toBe(400);
      expect(endpoints.changePassword).not.toHaveBeenCalled();
    });

  it.each([[{}], [{ newEmail: 'b@example.test' }], [{ newEmail: 'b@example.test', currentPassword: 'x', userId: 'u2' }]])(
    'el cambio de correo rechaza el cuerpo %j con 400', async body => {
      const { app, endpoints } = build();
      expect((await call(app, 'post', '/me/email/change', body)).status).toBe(400);
      expect(endpoints.requestEmailChange).not.toHaveBeenCalled();
    });

  it('responde 202/204 sin cuerpo y traduce los errores sin detalles internos', async () => {
    const { app } = build();
    const accepted = await call(app, 'post', '/me/email/change', { newEmail: 'b@example.test', currentPassword: 'x' });
    expect(accepted.status).toBe(202); expect(accepted.text).toBe('');
    expect((await call(app, 'post', '/me/password', { currentPassword: 'x', newPassword: 'y' })).status).toBe(204);
    const cases: Array<[Error, number]> = [[new ReauthenticationError(), 401], [new Error('Entrada inválida'), 400],
      [new Error('No autorizado'), 401], [new Error('boom: detalle SQL'), 500], [Object.assign(new Error('x'), { code: '23514' }), 400]];
    for (const [error, status] of cases) {
      const response = await call(build({ changePassword: vi.fn().mockRejectedValue(error) }).app, 'post', '/me/password',
        { currentPassword: 'x', newPassword: 'y' });
      expect(response.status).toBe(status);
      expect(JSON.stringify(response.body)).not.toContain('SQL');
    }
    const limited = await call(build({ changePassword: vi.fn().mockRejectedValue(new RateLimitedError(90)) }).app, 'post', '/me/password',
      { currentPassword: 'x', newPassword: 'y' });
    expect(limited.status).toBe(429); expect(limited.headers['retry-after']).toBe('90');
  });
});

describe('F01.1 US5: validación del parche de perfil (solo seis campos propios)', () => {
  it('normaliza los campos permitidos', () => {
    expect(validateProfilePatch({ displayName: '  Ana ', phone: ' +51 999 111 222 ', avatarPreset: 3, theme: 'CLARO',
      notifyReservations: false, notifySecurity: true })).toEqual({ displayName: 'Ana', phone: '+51 999 111 222', avatarPreset: 3,
      theme: 'CLARO', notifyReservations: false, notifySecurity: true });
    expect(validateProfilePatch({ phone: null, avatarPreset: null })).toEqual({ phone: null, avatarPreset: null });
  });

  it.each([[null], [[]], ['x'], [{}], [{ role: 'DUENO' }], [{ roles: [] }], [{ capabilities: [] }], [{ membershipId: 'm' }], [{ estado: 'X' }],
    [{ email: 'a@b.co' }], [{ userId: 'u' }], [{ theme: 'MORADO' }], [{ avatarPreset: 0 }], [{ avatarPreset: 13 }], [{ avatarPreset: '3' }],
    [{ phone: '12' }], [{ phone: 5 }], [{ displayName: 'x'.repeat(121) }], [{ notifySecurity: 1 }], [{ displayName: 'Ok', rol: 'DUENO' }]])(
    'rechaza %j', input => { expect(() => validateProfilePatch(input)).toThrow('Entrada inválida'); });
});
