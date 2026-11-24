import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';
import { authHttpSecurity } from '../../src/modules/usuarios/presentation/auth-middleware.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const secret = 'a'.repeat(64);
const sessionCookie = `ff-session-local=${secret}`;
const token = 'T'.repeat(43);

function build(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const recovery = {
    requestPasswordReset: vi.fn().mockResolvedValue(undefined),
    confirmPasswordReset: vi.fn().mockResolvedValue(undefined),
    verifyEmail: vi.fn().mockResolvedValue(undefined),
    requestEmailVerification: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const identity = { register: vi.fn(), login: vi.fn(), session: vi.fn(), logout: vi.fn() };
  const app = express();
  app.use('/api/v1', createIdentityRouter(identity as never, options, recovery as never));
  return { app, recovery };
}

async function post(app: express.Express, path: string, body: unknown, { csrf = true, cookie = '' } = {}) {
  const security = authHttpSecurity(options);
  const wrapper = express();
  wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res));
  wrapper.use(app);
  const agent = request.agent(wrapper);
  const issued = await agent.get('/csrf').set('Cookie', cookie).expect(200);
  const call = agent.post(`/api/v1${path}`).set('Origin', origin).set('Cookie', cookie);
  if (csrf) call.set('X-CSRF-Token', issued.body.csrfToken);
  return call.send(body as object);
}

describe('F01.1 US3 · restablecimiento y verificación (router)', () => {
  it('sin recuperación compuesta las rutas no existen (404)', async () => {
    const app = express();
    app.use('/api/v1', createIdentityRouter({ register: vi.fn(), login: vi.fn(), session: vi.fn(), logout: vi.fn() } as never, options));
    await request(app).post('/api/v1/auth/password/reset/request').send({}).expect(404);
  });

  it('exige CSRF en las cuatro mutaciones y no invoca el caso de uso', async () => {
    const { app, recovery } = build();
    for (const [path, body] of [['/auth/password/reset/request', { email: 'a@example.test' }],
      ['/auth/password/reset/confirm', { token, newPassword: 'clave-definitiva-123' }], ['/auth/email/verify', { token }],
      ['/me/email/verification', {}]] as const) {
      expect((await post(app, path, body, { csrf: false, cookie: sessionCookie })).status).toBe(403);
    }
    expect(Object.values(recovery).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it('solicitar responde 202 sin cuerpo, siempre igual, y no devuelve ningún código', async () => {
    const { app, recovery } = build();
    const response = await post(app, '/auth/password/reset/request', { email: 'ana@example.test' });
    expect(response.status).toBe(202);
    expect(response.text).toBe('');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(recovery.requestPasswordReset).toHaveBeenCalledWith('ana@example.test', expect.any(String));
  });

  it.each([[{}], [{ email: 'a@example.test', extra: 1 }], [['a@example.test']], [{ correo: 'a@example.test' }]])(
    'rechaza el cuerpo inválido %j con 400', async body => {
      const { app, recovery } = build();
      expect((await post(app, '/auth/password/reset/request', body)).status).toBe(400);
      expect(recovery.requestPasswordReset).not.toHaveBeenCalled();
    });

  it('un correo mal formado devuelve 400 y el límite devuelve 429 con Retry-After', async () => {
    const invalid = build({ requestPasswordReset: vi.fn().mockRejectedValue(new Error('Entrada inválida')) });
    expect((await post(invalid.app, '/auth/password/reset/request', { email: 'no-es-correo' })).status).toBe(400);
    const limited = build({ requestPasswordReset: vi.fn().mockRejectedValue(new RateLimitedError(840)) });
    const response = await post(limited.app, '/auth/password/reset/request', { email: 'ana@example.test' });
    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('840');
  });

  it('confirmar responde 204 y limpia cualquier cookie de sesión; el token inválido recibe un 400 genérico', async () => {
    const { app, recovery } = build();
    const ok = await post(app, '/auth/password/reset/confirm', { token, newPassword: 'clave-definitiva-123' }, { cookie: sessionCookie });
    expect(ok.status).toBe(204);
    expect(ok.headers['set-cookie']?.join(';') ?? '').toContain('ff-session-local=;');
    expect(recovery.confirmPasswordReset).toHaveBeenCalledWith(token, 'clave-definitiva-123', expect.any(String));
    const failing = build({ confirmPasswordReset: vi.fn().mockRejectedValue(new Error('Entrada inválida')) });
    const bad = await post(failing.app, '/auth/password/reset/confirm', { token, newPassword: 'clave-definitiva-123' });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).not.toMatch(/vencid|usad|exist/i);
  });

  it('confirmar y verificar exigen exactamente sus campos', async () => {
    const { app, recovery } = build();
    expect((await post(app, '/auth/password/reset/confirm', { token })).status).toBe(400);
    expect((await post(app, '/auth/password/reset/confirm', { token, newPassword: 'x', otro: 1 })).status).toBe(400);
    expect((await post(app, '/auth/email/verify', { token, extra: true })).status).toBe(400);
    expect((await post(app, '/auth/email/verify', {})).status).toBe(400);
    expect(recovery.confirmPasswordReset).not.toHaveBeenCalled();
    expect(recovery.verifyEmail).not.toHaveBeenCalled();
  });

  it('verificar responde 204; token inválido 400; límite 429', async () => {
    expect((await post(build().app, '/auth/email/verify', { token })).status).toBe(204);
    expect((await post(build({ verifyEmail: vi.fn().mockRejectedValue(new Error('Entrada inválida')) }).app, '/auth/email/verify', { token })).status).toBe(400);
    expect((await post(build({ verifyEmail: vi.fn().mockRejectedValue(new RateLimitedError(60)) }).app, '/auth/email/verify', { token })).status).toBe(429);
  });

  it('solicitar verificación exige sesión y la pasa al caso de uso', async () => {
    const { app, recovery } = build();
    expect((await post(app, '/me/email/verification', {})).status).toBe(401);
    expect(recovery.requestEmailVerification).not.toHaveBeenCalled();
    const ok = await post(app, '/me/email/verification', {}, { cookie: sessionCookie });
    expect(ok.status).toBe(202);
    expect(recovery.requestEmailVerification).toHaveBeenCalledWith(secret);
    const noEmail = build({ requestEmailVerification: vi.fn().mockRejectedValue(new Error('Entrada inválida')) });
    expect((await post(noEmail.app, '/me/email/verification', {}, { cookie: sessionCookie })).status).toBe(400);
  });

  it('un fallo interno no revela detalles', async () => {
    const { app } = build({ requestPasswordReset: vi.fn().mockRejectedValue(new Error('detalle interno secreto')) });
    const response = await post(app, '/auth/password/reset/request', { email: 'ana@example.test' });
    expect(response.status).toBe(500);
    expect(JSON.stringify(response.body)).not.toContain('secreto');
  });
});
