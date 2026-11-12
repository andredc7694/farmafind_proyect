import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';

// T043 is a contract-first suite. T048 must satisfy it after T044 proves RLS.
const origin = 'http://127.0.0.1:5173';
const pharmacyA = '00000000-0000-4000-8000-00000000000a';
const pharmacyB = '00000000-0000-4000-8000-00000000000b';
const actorId = '00000000-0000-4000-8000-000000000001';
const workerId = '00000000-0000-4000-8000-000000000002';
const membershipId = '00000000-0000-4000-8000-000000000003';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 8), cookieSecure: false };
const pathA = `/api/v1/pharmacies/${pharmacyA}/memberships`;
const pathB = `/api/v1/pharmacies/${pharmacyB}/memberships`;

async function setup(withAdminRouter = true) {
  const identity = {
    register: vi.fn(),
    login: vi.fn().mockResolvedValue({ secret: 'a'.repeat(64), view: { userId: actorId, email: 'actor@example.test', activePharmacyId: pharmacyA } }),
    session: vi.fn().mockResolvedValue({ userId: actorId, email: 'actor@example.test', activePharmacyId: pharmacyA }),
    logout: vi.fn(),
  };
  const worker = { id: membershipId, userId: workerId, pharmacyId: pharmacyA, role: 'TRABAJADOR', status: 'ACTIVA' };
  const management = {
    list: vi.fn().mockResolvedValue([worker]),
    grant: vi.fn().mockImplementation(async (_secret, pharmacyId) => {
      if (pharmacyId !== pharmacyA) throw new Error('No visible');
      return worker;
    }),
    revoke: vi.fn().mockImplementation(async (_secret, pharmacyId) => {
      if (pharmacyId !== pharmacyA) throw new Error('No visible');
      return { ...worker, status: 'REVOCADA' };
    }),
  };
  const app = createApp(createIdentityRouter(identity, options));
  if (withAdminRouter) {
    const modulePath = '../../src/modules/usuarios/presentation/admin-memberships-router.js';
    const { createAdminMembershipRouter } = await import(modulePath);
    app.use('/api/v1', createAdminMembershipRouter(identity, management, options));
  }
  const agent = request.agent(app);
  return { agent, identity, management, worker };
}

async function loggedIn() {
  const fixture = await setup();
  const pre = await fixture.agent.get('/api/v1/auth/csrf').expect(200);
  await fixture.agent.post('/api/v1/auth/login').set('Origin', origin)
    .set('X-CSRF-Token', pre.body.csrfToken)
    .send({ email: 'actor@example.test', password: 'ficticia' }).expect(200);
  const csrf = await fixture.agent.get('/api/v1/auth/csrf').expect(200);
  return { ...fixture, token: csrf.body.csrfToken };
}

describe('T043: contrato HTTP de membresias locales TRABAJADOR', () => {
  it('sin router administrativo no expone mutaciones privilegiadas', async () => {
    const { agent, management } = await setup(false);
    await agent.get(pathA).expect(404);
    await agent.post(pathA).send({ userId: actorId, role: 'DUENO' }).expect(404);
    await agent.patch(`${pathB}/${membershipId}`).send({ status: 'REVOCADA' }).expect(404);
    expect(management.list).not.toHaveBeenCalled();
    expect(management.grant).not.toHaveBeenCalled();
    expect(management.revoke).not.toHaveBeenCalled();
  });

  it('lista, concede y revoca solo TRABAJADOR de otra persona en A', async () => {
    const { agent, management, token } = await loggedIn();
    await agent.get(pathA).expect(200);
    await agent.post(pathA).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(201);
    await agent.patch(`${pathA}/${membershipId}`).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ status: 'REVOCADA' }).expect(200);
    expect(management.list).toHaveBeenCalledOnce();
    expect(management.grant).toHaveBeenCalledOnce();
    expect(management.revoke).toHaveBeenCalledOnce();
  });

  it('rechaza sesion ausente y CSRF/Origin invalidos antes de mutar', async () => {
    const { agent, management } = await setup();
    const pre = await agent.get('/api/v1/auth/csrf').expect(200);
    await agent.post(pathA).set('Origin', origin).set('X-CSRF-Token', pre.body.csrfToken)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(401);
    const logged = await loggedIn();
    await logged.agent.post(pathA).set('Origin', origin)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(403);
    await logged.agent.post(pathA).set('Origin', 'http://evil.invalid').set('X-CSRF-Token', logged.token)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(403);
    expect(management.grant).not.toHaveBeenCalled();
    expect(logged.management.grant).not.toHaveBeenCalled();
  });

  it('rechaza autoasignacion, rol no delegable y farmacia B sin revelar filas', async () => {
    const { agent, management, token } = await loggedIn();
    await agent.post(pathA).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: actorId, role: 'TRABAJADOR' }).expect(403);
    await agent.post(pathA).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: workerId, role: 'DUENO' }).expect(400);
    const cross = await agent.post(pathB).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(404);
    expect(JSON.stringify(cross.body)).not.toContain(workerId);
    expect(management.grant).toHaveBeenCalledOnce();
  });

  it('distingue conflicto 409 y cambio no autorizado sin eco de datos privados', async () => {
    const { agent, management, token } = await loggedIn();
    management.grant.mockRejectedValueOnce(new Error('Conflicto'));
    await agent.post(pathA).set('Origin', origin).set('X-CSRF-Token', token)
      .send({ userId: workerId, role: 'TRABAJADOR' }).expect(409);
    const cross = await agent.patch(`${pathB}/${membershipId}`).set('Origin', origin)
      .set('X-CSRF-Token', token).send({ status: 'REVOCADA' }).expect(404);
    expect(JSON.stringify(cross.body)).not.toContain(workerId);
    expect(management.revoke).toHaveBeenCalledOnce();
  });
});
