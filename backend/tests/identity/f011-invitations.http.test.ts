import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createStaffAccessRouter } from '../../src/modules/usuarios/presentation/staff-access-router.js';
import { MembershipConflictError, MembershipForbiddenError, MembershipNotVisibleError } from '../../src/modules/usuarios/application/manage-memberships.js';
import { SessionRestrictedError } from '../../src/modules/usuarios/application/ports.js';
import { StaffPolicyError } from '../../src/modules/usuarios/domain/staff-policy.js';
import { authHttpSecurity } from '../../src/modules/usuarios/presentation/auth-middleware.js';

const origin = 'http://127.0.0.1:5173';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 9), cookieSecure: false };
const secret = 'a'.repeat(64);
const cookie = `ff-session-local=${secret}`;
const pharmacy = '11111111-1111-4111-8111-111111111111';
const invitation = '44444444-4444-4444-8444-444444444444';
const membership = '55555555-5555-4555-8555-555555555555';
const actor = '22222222-2222-4222-8222-222222222222';

function build(overrides: Partial<Record<string, ReturnType<typeof vi.fn>>> = {}) {
  const access = {
    invite: vi.fn().mockResolvedValue(undefined),
    listInvitations: vi.fn().mockResolvedValue([{ id: invitation, destination: 'a***@example.test', state: 'PENDIENTE',
      createdAt: new Date('2026-11-23T10:00:00.000Z'), expiresAt: new Date('2026-11-30T10:00:00.000Z') }]),
    revokeInvitation: vi.fn().mockResolvedValue(undefined),
    setCapabilities: vi.fn().mockResolvedValue(undefined),
    listMine: vi.fn().mockResolvedValue([{ id: invitation, pharmacyName: 'Farmacia ficticia', state: 'PENDIENTE', expiresAt: new Date('2026-11-30T10:00:00.000Z') }]),
    accept: vi.fn().mockResolvedValue(undefined),
    decline: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  const app = express();
  app.use('/api/v1', createStaffAccessRouter({ session: vi.fn().mockResolvedValue({ userId: actor }) }, access as never, options));
  return { app, access };
}

async function mutate(app: express.Express, method: 'post' | 'put' | 'delete', path: string, body?: unknown, withCsrf = true) {
  const security = authHttpSecurity(options);
  const wrapper = express();
  wrapper.get('/csrf', (req, res) => security.issueCsrf(req, res));
  wrapper.use(app);
  const agent = request.agent(wrapper);
  const issued = await agent.get('/csrf').set('Cookie', cookie).expect(200);
  const call = agent[method](`/api/v1${path}`).set('Origin', origin).set('Cookie', cookie);
  if (withCsrf) call.set('X-CSRF-Token', issued.body.csrfToken);
  return body === undefined ? call : call.send(body as object);
}

describe('F01.1 US2 · invitaciones y permisos (router)', () => {
  it('exige CSRF en toda mutación y no invoca el caso de uso', async () => {
    const { app, access } = build();
    for (const [method, path, body] of [['post', `/pharmacies/${pharmacy}/staff/invitations`, { email: 'a@example.test' }],
      ['delete', `/pharmacies/${pharmacy}/staff/invitations/${invitation}`, undefined],
      ['put', `/pharmacies/${pharmacy}/staff/${membership}/capabilities`, { capabilities: [] }],
      ['post', `/me/invitations/${invitation}/accept`, undefined], ['post', `/me/invitations/${invitation}/decline`, undefined]] as const) {
      expect((await mutate(app, method, path, body, false)).status).toBe(403);
    }
    expect(Object.values(access).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it('sin sesión devuelve 401 uniforme en lecturas y mutaciones', async () => {
    const { app, access } = build();
    await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff/invitations`).expect(401);
    await request(app).get('/api/v1/me/invitations').expect(401);
    expect(access.listInvitations).not.toHaveBeenCalled();
    expect(access.listMine).not.toHaveBeenCalled();
  });

  it('invitar responde 202 sin cuerpo y no revela si la cuenta existe', async () => {
    const { app, access } = build();
    const response = await mutate(app, 'post', `/pharmacies/${pharmacy}/staff/invitations`, { email: 'ana@example.test' });
    expect(response.status).toBe(202);
    expect(response.text).toBe('');
    expect(access.invite).toHaveBeenCalledWith(secret, pharmacy, 'ana@example.test');
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it.each([[{}], [{ email: 'a@example.test', rol: 'DUENO' }], [['a@example.test']], [{ correo: 'a@example.test' }]])(
    'rechaza el cuerpo inválido %j con 400', async body => {
      const { app, access } = build();
      expect((await mutate(app, 'post', `/pharmacies/${pharmacy}/staff/invitations`, body)).status).toBe(400);
      expect(access.invite).not.toHaveBeenCalled();
    });

  it('valida los identificadores de la ruta antes de llamar al caso de uso', async () => {
    const { app, access } = build();
    expect((await mutate(app, 'post', '/pharmacies/no-uuid/staff/invitations', { email: 'a@example.test' })).status).toBe(400);
    expect((await mutate(app, 'delete', `/pharmacies/${pharmacy}/staff/invitations/no-uuid`)).status).toBe(400);
    expect((await mutate(app, 'put', `/pharmacies/${pharmacy}/staff/no-uuid/capabilities`, { capabilities: [] })).status).toBe(400);
    expect((await mutate(app, 'post', '/me/invitations/no-uuid/accept')).status).toBe(400);
    expect(Object.values(access).every(fn => fn.mock.calls.length === 0)).toBe(true);
  });

  it('el listado serializa fechas ISO y nunca el correo completo', async () => {
    const { app } = build();
    const response = await request(app).get(`/api/v1/pharmacies/${pharmacy}/staff/invitations`).set('Cookie', cookie).expect(200);
    expect(response.body).toEqual([{ id: invitation, destination: 'a***@example.test', state: 'PENDIENTE',
      createdAt: '2026-11-23T10:00:00.000Z', expiresAt: '2026-11-30T10:00:00.000Z' }]);
    const mine = await request(app).get('/api/v1/me/invitations').set('Cookie', cookie).expect(200);
    expect(mine.body).toEqual([{ id: invitation, pharmacyName: 'Farmacia ficticia', state: 'PENDIENTE', expiresAt: '2026-11-30T10:00:00.000Z' }]);
  });

  it('revocar, aceptar y rechazar responden 204', async () => {
    const { app, access } = build();
    expect((await mutate(app, 'delete', `/pharmacies/${pharmacy}/staff/invitations/${invitation}`)).status).toBe(204);
    expect((await mutate(app, 'post', `/me/invitations/${invitation}/accept`)).status).toBe(204);
    expect((await mutate(app, 'post', `/me/invitations/${invitation}/decline`)).status).toBe(204);
    expect(access.revokeInvitation).toHaveBeenCalledWith(secret, pharmacy, invitation);
    expect(access.accept).toHaveBeenCalledWith(secret, invitation);
    expect(access.decline).toHaveBeenCalledWith(secret, invitation);
  });

  it('los permisos exigen exactamente «capabilities» y responden 204', async () => {
    const { app, access } = build();
    expect((await mutate(app, 'put', `/pharmacies/${pharmacy}/staff/${membership}/capabilities`, { capabilities: ['inventory.read'] })).status).toBe(204);
    expect(access.setCapabilities).toHaveBeenCalledWith(secret, pharmacy, membership, ['inventory.read']);
    expect((await mutate(app, 'put', `/pharmacies/${pharmacy}/staff/${membership}/capabilities`, { capabilities: [], otro: 1 })).status).toBe(400);
    expect((await mutate(app, 'put', `/pharmacies/${pharmacy}/staff/${membership}/capabilities`, {})).status).toBe(400);
  });

  it.each([
    [new MembershipNotVisibleError(), 404, 'NOT_VISIBLE'], [new MembershipForbiddenError(), 403, 'FORBIDDEN'],
    [new MembershipConflictError(), 409, 'CONFLICT'], [new SessionRestrictedError('CAMBIO_CLAVE'), 403, 'FORBIDDEN'],
    [new StaffPolicyError('CAPACIDAD_INVALIDA'), 400, 'BAD_REQUEST'], [new Error('Entrada inválida'), 400, 'BAD_REQUEST'],
    [new Error('fallo interno con detalle'), 500, 'INTERNAL'],
  ])('mapea %o a %i sin revelar detalles', async (error, status, code) => {
    const { app } = build({ setCapabilities: vi.fn().mockRejectedValue(error) });
    const response = await mutate(app, 'put', `/pharmacies/${pharmacy}/staff/${membership}/capabilities`, { capabilities: [] });
    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    expect(JSON.stringify(response.body)).not.toContain('detalle');
  });
});
