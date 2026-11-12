import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { RateLimitedError } from '../../src/modules/usuarios/application/ports.js';

const view = { userId: '00000000-0000-4000-8000-000000000001', email: 'cliente@example.test', activePharmacyId: null };
const secret = 'a'.repeat(64);
const origin = 'http://127.0.0.1:5173';

function setup() {
  const identity = {
    register: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue({ secret, view }),
    session: vi.fn().mockResolvedValue(view),
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const router = createIdentityRouter(identity, {
    allowedOrigin: origin, csrfKey: Buffer.alloc(32, 7), cookieSecure: false,
  });
  return { agent: request.agent(createApp(router)), identity };
}

describe('contratos HTTP de identidad F01 sin operaciones administrativas', () => {
  it('registro con CSRF/Origin responde 202 sin credenciales ni privilegios', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    expect(csrf.body.csrfToken).toMatch(/^[a-f0-9]{64}$/);
    const response = await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'cliente@example.test', password: 'contraseña-ficticia' }).expect(202);
    expect(response.text).not.toContain('contraseña-ficticia');
    expect(identity.register).toHaveBeenCalledOnce();
  });

  it('login emite solo cookie HttpOnly y sesión devuelve DTO mínimo; logout la limpia', async () => {
    const { agent } = setup();
    const pre = await agent.get('/api/v1/auth/csrf').expect(200);
    const login = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', pre.body.csrfToken)
      .send({ email: view.email, password: 'contraseña-ficticia' }).expect(200);
    expect(login.body).toEqual(view);
    expect(JSON.stringify(login.body)).not.toContain(secret);
    expect(login.headers['set-cookie']?.join(';')).toContain('HttpOnly');
    await agent.get('/api/v1/auth/session').expect(200, view);
    await agent.post('/api/v1/auth/logout').set('Origin', origin)
      .set('X-CSRF-Token', pre.body.csrfToken).expect(403);
    const post = await agent.get('/api/v1/auth/csrf').expect(200);
    await agent.post('/api/v1/auth/logout').set('Origin', origin)
      .set('X-CSRF-Token', post.body.csrfToken).expect(204);
    await agent.get('/api/v1/auth/session').expect(401);
  });

  it('rechaza Origin ajeno y CSRF ausente sin ejecutar mutación', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    await agent.post('/api/v1/auth/register').set('Origin', 'http://evil.invalid')
      .set('X-CSRF-Token', csrf.body.csrfToken).send({ email: view.email, password: 'x' }).expect(403);
    await agent.post('/api/v1/auth/register').set('Origin', origin)
      .send({ email: view.email, password: 'x' }).expect(403);
    expect(identity.register).not.toHaveBeenCalled();
  });

  it('devuelve 429 genérico y Retry-After sin revelar cuenta ni eco de entrada', async () => {
    const { agent, identity } = setup();
    identity.login.mockRejectedValueOnce(new RateLimitedError(42));
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const response = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'nadie@example.test', password: 'incorrecta' }).expect(429);
    expect(response.headers['retry-after']).toBe('42');
    expect(JSON.stringify(response.body)).not.toContain('nadie@example.test');
    expect(JSON.stringify(response.body)).not.toContain('incorrecta');
  });

  it('distingue 400 entrada inválida y 401 credenciales/sesión, con mensajes genéricos', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    identity.login.mockRejectedValueOnce(new Error('Entrada inválida'));
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'mal', password: '' }).expect(400);
    identity.login.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'nadie@example.test', password: 'incorrecta' }).expect(401);
    await agent.get('/api/v1/auth/session').expect(401);
  });
  it('rechaza JSON malformado sin devolver el contenido del cuerpo', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const response = await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken).set('Content-Type', 'application/json')
      .send('{"secret":"no-publicar",').expect(400);
    expect(JSON.stringify(response.body)).not.toContain('no-publicar');
    expect(identity.register).not.toHaveBeenCalled();
  });
  it('usa cookie Secure y prefijo de host con HTTPS y rechaza HTTP fuera de loopback', async () => {
    const identity = { register: vi.fn(), login: vi.fn(), session: vi.fn(), logout: vi.fn() };
    const router = createIdentityRouter(identity, {
      allowedOrigin: 'https://farmafind.example.test', csrfKey: Buffer.alloc(32, 7), cookieSecure: true,
    });
    const response = await request(createApp(router)).get('/api/v1/auth/csrf').expect(200);
    expect(response.headers['set-cookie']?.join(';')).toContain('__Host-ff-csrf=');
    expect(response.headers['set-cookie']?.join(';')).toContain('Secure');
    expect(() => createIdentityRouter(identity, {
      allowedOrigin: 'http://farmafind.example.test', csrfKey: Buffer.alloc(32, 7), cookieSecure: false,
    })).toThrow();
  });
  it('mantiene respuesta generica tras cinco fallos de login y sexto limitado', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    identity.login.mockImplementation(async () => {
      if (identity.login.mock.calls.length > 5) throw new RateLimitedError(60);
      throw new Error('Credenciales inválidas');
    });
    for (let index = 0; index < 5; index++) {
      await agent.post('/api/v1/auth/login').set('Origin', origin)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: 'noexiste@example.test', password: 'incorrecta' }).expect(401);
    }
    const limited = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'noexiste@example.test', password: 'incorrecta' }).expect(429);
    expect(limited.headers['retry-after']).toBe('60');
    expect(JSON.stringify(limited.body)).not.toContain('noexiste@example.test');
    expect(identity.login.mock.calls.every(call => call[2] === identity.login.mock.calls[0][2])).toBe(true);
  });

  it('aplica el mismo contrato 429 a registro repetido sin enumerar cuentas', async () => {
    const { agent, identity } = setup();
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    identity.register.mockImplementation(async () => {
      if (identity.register.mock.calls.length > 5) throw new RateLimitedError(45);
    });
    for (let index = 0; index < 5; index++) {
      await agent.post('/api/v1/auth/register').set('Origin', origin)
        .set('X-CSRF-Token', csrf.body.csrfToken)
        .send({ email: `cliente${index}@example.test`, password: 'ficticia' }).expect(202);
    }
    const limited = await agent.post('/api/v1/auth/register').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ email: 'otro@example.test', password: 'ficticia' }).expect(429);
    expect(limited.headers['retry-after']).toBe('45');
    expect(JSON.stringify(limited.body)).not.toContain('otro@example.test');
  });
});
