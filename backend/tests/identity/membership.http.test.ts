import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { createMembershipRouter } from '../../src/modules/usuarios/presentation/membership-router.js';

const origin = 'http://127.0.0.1:5173';
const secret = 'a'.repeat(64);
const pharmacyA = '00000000-0000-4000-8000-00000000000a';
const pharmacyB = '00000000-0000-4000-8000-00000000000b';
const pharmacyOther = '00000000-0000-4000-8000-00000000000c';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 8), cookieSecure: false };

async function setup() {
  const identity = {
    register: vi.fn(), login: vi.fn().mockResolvedValue({ secret, view: { userId: 'fixture', email: 'fixture@example.test', activePharmacyId: null } }),
    session: vi.fn().mockResolvedValue({ userId: 'fixture', email: 'fixture@example.test', activePharmacyId: null }),
    auditDenied: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(),
  };
  const own = [
    { pharmacyId: pharmacyA, pharmacyName: 'Farmacia A', roleCode: 'TRABAJADOR', delegationCodes: ['LECTURA'] },
    { pharmacyId: pharmacyB, pharmacyName: 'Farmacia B', roleCode: 'TRABAJADOR', delegationCodes: [] },
  ];
  const memberships = {
    listAvailable: vi.fn().mockResolvedValue(own),
    select: vi.fn().mockImplementation(async (_secret, id) => {
      const found = own.find(item => item.pharmacyId === id);
      if (!found) throw new Error('No autorizado');
      return { pharmacyId: found.pharmacyId, roleCode: found.roleCode, delegationCodes: found.delegationCodes };
    }),
  };
  const agent = request.agent(createApp(createIdentityRouter(identity, options), createMembershipRouter(identity, memberships, options)));
  const pre = await agent.get('/api/v1/auth/csrf').expect(200);
  await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', pre.body.csrfToken)
    .send({ email: 'fixture@example.test', password: 'ficticia' }).expect(200);
  const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
  return { agent, identity, memberships, token: csrf.body.csrfToken };
}

describe('HTTP de membresias propias F01', () => {
  it('lista A/B propias y selecciona B sin transferir delegaciones de A', async () => {
    const { agent, token } = await setup();
    const list = await agent.get('/api/v1/me/memberships').expect(200);
    expect(list.body).toHaveLength(2);
    const selected = await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', token).send({ pharmacyId: pharmacyB }).expect(200);
    expect(selected.body).toEqual({ pharmacyId: pharmacyB, roleCode: 'TRABAJADOR', delegationCodes: [] });
    expect(JSON.stringify(selected.body)).not.toContain('LECTURA');
  });

  it('rechaza B ajena, ID manipulado y revocacion sin revelar filas', async () => {
    const { agent, identity, memberships, token } = await setup();
    const denied = await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', token).send({ pharmacyId: pharmacyOther }).expect(404);
    expect(identity.auditDenied).toHaveBeenCalledWith(secret, 'PHARMACY_SELECT', denied.body.correlationId);
    await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', token).send({ pharmacyId: 'not-a-uuid' }).expect(400);
    expect(memberships.select).toHaveBeenCalledTimes(1);
    identity.session.mockRejectedValueOnce(new Error('No autorizado'));
    await agent.get('/api/v1/me/memberships').expect(401);
  });

  it('rechaza farmacia inactiva o membresia revocada y CSRF ausente', async () => {
    const { agent, memberships, token } = await setup();
    memberships.select.mockRejectedValueOnce(new Error('No autorizado'));
    await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', token).send({ pharmacyId: pharmacyB }).expect(404);
    await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .send({ pharmacyId: pharmacyA }).expect(403);
    expect(memberships.select).toHaveBeenCalledTimes(1);
  });

  it('no expone rutas de mutacion de membresias de terceros', async () => {
    const { agent } = await setup();
    await agent.post(`/api/v1/pharmacies/${pharmacyA}/memberships`).expect(404);
  });
});
