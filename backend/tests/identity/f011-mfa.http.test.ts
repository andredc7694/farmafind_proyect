import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createMfaRouter } from '../../src/modules/usuarios/presentation/mfa-router.js';
import { authHttpSecurity } from '../../src/modules/usuarios/presentation/auth-middleware.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';
import { MfaConflictError, MfaForbiddenError, MfaInvalidCodeError } from '../../src/modules/usuarios/application/mfa.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const secret = 'a'.repeat(64);
const cookie = `ff-session-local=${secret}`;

function build(overrides: Record<string, ReturnType<typeof vi.fn>> = {}) {
  const mfa = {
    enroll: vi.fn().mockResolvedValue({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x' }),
    activate: vi.fn().mockResolvedValue(undefined), verify: vi.fn().mockResolvedValue(undefined), ...overrides };
  const app = express();
  app.use('/api/v1', createMfaRouter(mfa, options));
  return { app, mfa };
}

async function post(app: express.Express, path: string, body?: unknown, { csrf = true, withCookie = true } = {}) {
  const security = authHttpSecurity(options);
  const wrapper = express();
  wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res));
  wrapper.use(app);
  const agent = request.agent(wrapper);
  const issued = await agent.get('/csrf').set('Cookie', withCookie ? cookie : '').expect(200);
  const call = agent.post(`/api/v1${path}`).set('Origin', origin).set('Cookie', withCookie ? cookie : '');
  if (csrf) call.set('X-CSRF-Token', issued.body.csrfToken);
  return body === undefined ? call : call.send(body as object);
}

describe('F01.1 US4: rutas del segundo factor (router)', () => {
  it('exigen CSRF y sesión antes de invocar el caso de uso', async () => {
    const { app, mfa } = build();
    for (const [path, body] of [['/me/mfa/enroll', undefined], ['/me/mfa/activate', { code: '123456' }], ['/auth/mfa/verify', { code: '123456' }]] as const) {
      expect((await post(app, path, body, { csrf: false })).status).toBe(403);
      expect((await post(app, path, body, { withCookie: false })).status).toBe(401);
    }
    expect(Object.values(mfa).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it('el alta devuelve el secreto una vez con no-store; activar y verificar responden 204 sin cuerpo', async () => {
    const { app, mfa } = build();
    const enrolled = await post(app, '/me/mfa/enroll');
    expect(enrolled.status).toBe(201);
    expect(enrolled.headers['cache-control']).toBe('no-store');
    expect(enrolled.body).toEqual({ secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/x' });
    for (const path of ['/me/mfa/activate', '/auth/mfa/verify']) {
      const response = await post(app, path, { code: '123456' });
      expect(response.status).toBe(204);
      expect(response.text).toBe('');
    }
    expect(mfa.activate).toHaveBeenCalledWith(secret, '123456');
    expect(mfa.verify).toHaveBeenCalledWith(secret, '123456');
  });

  it.each([[{}], [{ code: '123456', extra: 1 }], [['123456']], [{ otp: '123456' }]])('rechaza el cuerpo %j con 400', async body => {
    const { app, mfa } = build();
    for (const path of ['/me/mfa/activate', '/auth/mfa/verify']) expect((await post(app, path, body)).status).toBe(400);
    expect(mfa.activate).not.toHaveBeenCalled();
    expect(mfa.verify).not.toHaveBeenCalled();
  });

  it('traduce los errores sin detalles internos', async () => {
    const cases: Array<[Error, number]> = [[new MfaForbiddenError(), 403], [new MfaConflictError(), 409],
      [new MfaInvalidCodeError(), 401], [new Error('No autorizado'), 401], [new Error('boom: detalle SQL'), 500]];
    for (const [error, status] of cases) {
      const { app } = build({ verify: vi.fn().mockRejectedValue(error) });
      const response = await post(app, '/auth/mfa/verify', { code: '123456' });
      expect(response.status).toBe(status);
      expect(JSON.stringify(response.body)).not.toContain('SQL');
    }
    const { app } = build({ verify: vi.fn().mockRejectedValue(new RateLimitedError(120)) });
    const limited = await post(app, '/auth/mfa/verify', { code: '123456' });
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('120');
  });
});
