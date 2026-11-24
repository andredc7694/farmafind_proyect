import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createStaffRouter } from '../../src/modules/usuarios/presentation/staff-router.js';
import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from '../../src/modules/usuarios/application/manage-memberships.js';
import { SessionRestrictedError } from '../../src/modules/usuarios/application/ports.js';
import { StaffPolicyError } from '../../src/modules/usuarios/domain/staff-policy.js';
import { authHttpSecurity } from '../../src/modules/usuarios/presentation/auth-middleware.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const secret = 'a'.repeat(64);
const pharmacy = '11111111-1111-4111-8111-111111111111';
const actor = '22222222-2222-4222-8222-222222222222';

function build(overrides: { create?: ReturnType<typeof vi.fn>; list?: ReturnType<typeof vi.fn>; session?: ReturnType<typeof vi.fn> } = {}) {
  const create = overrides.create ?? vi.fn().mockResolvedValue({ userId: '33333333-3333-4333-8333-333333333333', alias: 'alfa.caja1',
    temporaryPassword: 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789', expiresAt: new Date('2026-11-24T10:00:00.000Z') });
  const list = overrides.list ?? vi.fn().mockResolvedValue([]);
  const session = overrides.session ?? vi.fn().mockResolvedValue({ userId: actor });
  const app = express();
  app.use('/api/v1', createStaffRouter({ session }, { create, list }, options));
  return { app, create, list, session };
}

describe('F01.1 US1 · POST /pharmacies/{id}/staff (router)', () => {
  it('exige CSRF y origen confiable', async () => {
    const { app, create } = build();
    await request(app).post(`/api/v1/pharmacies/${pharmacy}/staff`).set('Cookie', `ff-session-local=${secret}`)
      .send({ alias: 'alfa.caja1', displayName: 'Caja' }).expect(403);
    expect(create).not.toHaveBeenCalled();
  });

  it('exige sesión: sin cookie 401 y sin invocar el caso de uso', async () => {
    const { app, create } = build();
    await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff`).expect(401);
    expect(create).not.toHaveBeenCalled();
  });

  it('la sesión inválida del identificador devuelve 401 uniforme', async () => {
    const { app } = build({ session: vi.fn().mockRejectedValue(new Error('No autorizado')) });
    await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff`).set('Cookie', `ff-session-local=${secret}`).expect(401);
  });

  it('GET valida el identificador de farmacia y mapea errores sin revelar detalles', async () => {
    const cases: Array<[Error, number, string]> = [
      [new MembershipNotVisibleError(), 404, 'NOT_VISIBLE'], [new MembershipForbiddenError(), 403, 'FORBIDDEN'],
      [new SessionRestrictedError('CAMBIO_CLAVE'), 403, 'FORBIDDEN'], [new Error('fallo interno con detalle'), 500, 'INTERNAL']];
    for (const [error, status, code] of cases) {
      const { app } = build({ list: vi.fn().mockRejectedValue(error) });
      const response = await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff`).set('Cookie', `ff-session-local=${secret}`).expect(status);
      expect(response.body.code).toBe(code);
      expect(JSON.stringify(response.body)).not.toContain('detalle');
    }
    const { app } = build();
    await request(app).get('/api/v1/pharmacies/no-es-uuid/staff').set('Cookie', `ff-session-local=${secret}`).expect(400);
  });

  it('GET responde con Cache-Control no-store', async () => {
    const { app } = build();
    const response = await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff`).set('Cookie', `ff-session-local=${secret}`).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});

describe('F01.1 US1 · cuerpo y errores de POST (con CSRF válido)', () => {
  async function postStaff(app: express.Express, body: unknown) {
    const security = authHttpSecurity(options);
    const wrapper = express();
    wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res));
    wrapper.use(app);
    const agent = request.agent(wrapper);
    const issued = await agent.get('/csrf').set('Cookie', `ff-session-local=${secret}`).expect(200);
    return agent.post(`/api/v1/pharmacies/${pharmacy}/staff`).set('Origin', origin)
      .set('Cookie', `ff-session-local=${secret}`).set('X-CSRF-Token', issued.body.csrfToken).send(body as object);
  }

  it('crea con 201 y devuelve la clave temporal con su vencimiento', async () => {
    const { app, create } = build();
    const response = await postStaff(app, { alias: 'alfa.caja1', displayName: 'Caja uno', capabilities: ['inventory.read'] });
    expect(response.status).toBe(201);
    expect(response.body).toEqual({ userId: '33333333-3333-4333-8333-333333333333', alias: 'alfa.caja1',
      temporaryPassword: 'ABCDEFGH-JKMNPQRS-TVWXYZ01-23456789', expiresAt: '2026-11-24T10:00:00.000Z' });
    expect(create).toHaveBeenCalledWith(secret, pharmacy, { alias: 'alfa.caja1', displayName: 'Caja uno', capabilities: ['inventory.read'] });
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['sin alias', { displayName: 'x' }], ['sin nombre', { alias: 'alfa.caja1' }], ['campo extra', { alias: 'alfa.caja1', displayName: 'x', role: 'DUENO' }],
    ['cuerpo no objeto', ['alfa.caja1']], ['cuerpo vacío', {}],
  ])('rechaza %s con 400 sin invocar el caso de uso', async (_name, body) => {
    const { app, create } = build();
    expect((await postStaff(app, body)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it.each([
    [new MembershipConflictError(), 409, 'CONFLICT'], [new MembershipForbiddenError(), 403, 'FORBIDDEN'],
    [new MembershipNotVisibleError(), 404, 'NOT_VISIBLE'], [new StaffPolicyError('CAPACIDAD_INVALIDA'), 400, 'BAD_REQUEST'],
    [new Error('Entrada inválida'), 400, 'BAD_REQUEST'],
  ])('mapea %o a %i', async (error, status, code) => {
    const { app } = build({ create: vi.fn().mockRejectedValue(error) });
    const response = await postStaff(app, { alias: 'alfa.caja1', displayName: 'x' });
    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
  });

  it('el 409 es genérico y no revela a quién pertenece el alias', async () => {
    const { app } = build({ create: vi.fn().mockRejectedValue(new MembershipConflictError()) });
    const response = await postStaff(app, { alias: 'alfa.caja1', displayName: 'x' });
    expect(response.status).toBe(409);
    expect(JSON.stringify(response.body)).not.toMatch(/alfa|usuario|existe/i);
  });
});
