import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { createPlatformAuthorizationRouter } from '../../src/modules/usuarios/presentation/platform-authorization-router.js';
import { ManagePlatformAuthorizations, PlatformAuthorizationForbiddenError } from
  '../../src/modules/usuarios/application/manage-platform-authorizations.js';
import { PLATFORM_PERMISSIONS, validPlatformMutation } from
  '../../src/modules/usuarios/domain/platform-authorization-policy.js';

const origin = 'http://127.0.0.1:5173';
const actorId = '00000000-0000-4000-8000-000000000001';
const targetId = '00000000-0000-4000-8000-000000000002';
const assignmentId = '00000000-0000-4000-8000-000000000003';
const approvalId = '00000000-0000-4000-8000-000000000004';
const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 42), cookieSecure: false };
const view = { id: assignmentId, userId: targetId, role: 'ADMINISTRADOR_PLATAFORMA' as const,
  status: 'ACTIVA' as const, grantedAt: new Date(0).toISOString(), revokedAt: null };

async function setup() {
  const identity = { register: vi.fn(), login: vi.fn().mockResolvedValue({ secret: 'a'.repeat(64),
    view: { userId: actorId, email: 'global@example.test', activePharmacyId: null } }),
  session: vi.fn().mockResolvedValue({ userId: actorId, email: 'global@example.test', activePharmacyId: null }),
  logout: vi.fn() };
  const management = { list: vi.fn().mockResolvedValue([view]), grant: vi.fn().mockResolvedValue(view),
    revoke: vi.fn().mockResolvedValue({ ...view, status: 'REVOCADA', revokedAt: new Date(1).toISOString() }) };
  const app = createApp(createIdentityRouter(identity, options));
  app.use('/api/v1', createPlatformAuthorizationRouter(identity, management, options));
  const agent = request.agent(app);
  const pre = await agent.get('/api/v1/auth/csrf').expect(200);
  await agent.post('/api/v1/auth/login').set('Origin', origin).set('X-CSRF-Token', pre.body.csrfToken)
    .send({ email: 'global@example.test', password: 'ficticia' }).expect(200);
  const csrf = (await agent.get('/api/v1/auth/csrf').expect(200)).body.csrfToken as string;
  return { agent, management, csrf };
}

describe('GLO-01: catalogo, politica y contrato global acotados', () => {
  it('mantiene un unico rol y exactamente cinco permisos inmutables', () => {
    expect(PLATFORM_PERMISSIONS).toEqual(['PLATFORM_USER_READ','PLATFORM_USER_STATUS_MANAGE',
      'PLATFORM_GLOBAL_AUTH_READ','PLATFORM_GLOBAL_AUTH_MANAGE','PLATFORM_AUDIT_READ']);
    expect(validPlatformMutation({ actorUserId: actorId, targetUserId: targetId,
      role: 'ADMINISTRADOR_PLATAFORMA', approvalId })).toBe(true);
    expect(validPlatformMutation({ actorUserId: actorId, targetUserId: actorId,
      role: 'ADMINISTRADOR_PLATAFORMA', approvalId })).toBe(false);
    expect(validPlatformMutation({ actorUserId: actorId, targetUserId: targetId,
      role: 'SUPERADMIN', approvalId })).toBe(false);
  });

  it('lista, concede y revoca por rutas especificas con CSRF', async () => {
    const { agent, management, csrf } = await setup();
    await agent.get('/api/v1/platform/role-assignments').expect(200);
    await agent.post('/api/v1/platform/role-assignments').set('Origin',origin).set('X-CSRF-Token',csrf)
      .send({ userId: targetId, role: 'ADMINISTRADOR_PLATAFORMA', approvalId }).expect(201);
    await agent.patch(`/api/v1/platform/role-assignments/${assignmentId}`).set('Origin',origin)
      .set('X-CSRF-Token',csrf).send({ status: 'REVOCADA', approvalId }).expect(200);
    expect(management.grant).toHaveBeenCalledOnce();
    expect(management.revoke).toHaveBeenCalledOnce();
  });

  it('rechaza autoelevacion, rol arbitrario, cuerpo adicional y falta de CSRF', async () => {
    const { agent, management, csrf } = await setup();
    await agent.post('/api/v1/platform/role-assignments').set('Origin',origin).set('X-CSRF-Token',csrf)
      .send({ userId: actorId, role: 'ADMINISTRADOR_PLATAFORMA', approvalId }).expect(403);
    await agent.post('/api/v1/platform/role-assignments').set('Origin',origin).set('X-CSRF-Token',csrf)
      .send({ userId: targetId, role: 'SUPERADMIN', approvalId }).expect(400);
    await agent.post('/api/v1/platform/role-assignments').set('Origin',origin).set('X-CSRF-Token',csrf)
      .send({ userId: targetId, role: 'ADMINISTRADOR_PLATAFORMA', approvalId, permission: '*' }).expect(400);
    await agent.post('/api/v1/platform/role-assignments')
      .send({ userId: targetId, role: 'ADMINISTRADOR_PLATAFORMA', approvalId }).expect(403);
    expect(management.grant).not.toHaveBeenCalled();
  });

  it('traduce una denegacion sin revelar objetivo o aprobacion', async () => {
    const { agent, management, csrf } = await setup();
    management.grant.mockRejectedValueOnce(new PlatformAuthorizationForbiddenError());
    const response = await agent.post('/api/v1/platform/role-assignments').set('Origin',origin)
      .set('X-CSRF-Token',csrf).send({ userId: targetId, role: 'ADMINISTRADOR_PLATAFORMA', approvalId }).expect(403);
    expect(JSON.stringify(response.body)).not.toContain(targetId);
    expect(JSON.stringify(response.body)).not.toContain(approvalId);
  });
});

describe('caso de uso GLO-01', () => {
  it('no invoca infraestructura ante autoelevacion', async () => {
    const transaction = { list: vi.fn(), grant: vi.fn(), revoke: vi.fn() };
    const unit = { runPlatform: vi.fn(async (_secret: string, work: Function) => work(transaction, actorId)) };
    const service = new ManagePlatformAuthorizations(unit);
    expect(() => service.grant('a'.repeat(64),actorId,actorId,'ADMINISTRADOR_PLATAFORMA',approvalId))
      .toThrow(PlatformAuthorizationForbiddenError);
    expect(unit.runPlatform).not.toHaveBeenCalled();
  });
});
