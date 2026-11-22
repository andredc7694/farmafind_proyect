import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { publicPharmacyView } from '../../src/modules/usuarios/presentation/public-projection.js';
import { PgAuthAuditRepository } from '../../src/modules/usuarios/infrastructure/audit-repository.js';
import { createApp } from '../../src/app.js';
import { createIdentityRouter } from '../../src/modules/usuarios/presentation/auth-router.js';
import { createMembershipRouter } from '../../src/modules/usuarios/presentation/membership-router.js';

describe('proyección pública F01', () => {
  it('excluye credenciales, membresías y datos internos aunque el objeto de entrada los contenga', () => {
    const source = {
      id: 'farmacia-ficticia',
      state: 'ACTIVA' as const,
      publicName: 'Farmacia ficticia',
      passwordHash: '$argon2id$fixture',
      tokenFingerprint: 'solo-fixture',
      memberships: [{ userId: 'persona-ficticia' }],
      internalNote: 'reservado',
    };
    const result = publicPharmacyView(source);
    expect(result).toEqual({ id: 'farmacia-ficticia', name: 'Farmacia ficticia' });
    expect(JSON.stringify(result)).not.toMatch(/password|token|membership|internal|reservado/i);
  });
});

describe('minimizacion de salida y auditoria F01', () => {
  it('la auditoria usa solo columnas y parametros permitidos, sin payload ni secreto', async () => {
    const sql = { query: vi.fn().mockResolvedValue({ rows: [] }) };
    const event = { actorUserId: null, pharmacyId: null, action: 'LOGIN', resourceType: 'IDENTITY',
      result: 'DENEGADO' as const, occurredAt: new Date('2026-11-11T12:00:00Z'),
      correlationId: '00000000-0000-4000-8000-000000000001' };
    await new PgAuthAuditRepository(sql).record(event);
    const [statement, values] = sql.query.mock.calls[0];
    expect(statement).toContain('INSERT INTO f01.auditoria_acceso');
    expect(values).toEqual([null, null, 'LOGIN', 'IDENTITY', 'DENEGADO', event.occurredAt, event.correlationId]);
    expect(JSON.stringify(values)).not.toMatch(/password|token|cookie|email|payload/i);
    await expect(new PgAuthAuditRepository(sql).record({ ...event, pharmacyId: 'otra-farmacia' }))
      .rejects.toThrow('Evento de auditoria F01 invalido');
  });

  it('respuesta de identidad y error por farmacia ajena no exponen secreto, cookie ni fila B', async () => {
    const origin = 'http://127.0.0.1:5173';
    const options = { allowedOrigin: origin, csrfKey: Buffer.alloc(32, 4), cookieSecure: false };
    const sessionSecret = 'f'.repeat(64);
    const identity = {
      register: vi.fn(), login: vi.fn().mockResolvedValue({ secret: sessionSecret,
        view: { userId: 'fixture', email: 'cliente@example.test', activePharmacyId: null } }),
      session: vi.fn().mockResolvedValue({ userId: 'fixture', email: 'cliente@example.test', activePharmacyId: null }),
      auditDenied: vi.fn().mockResolvedValue(undefined),
      logout: vi.fn(),
    };
    const memberships = { listAvailable: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockRejectedValue(new Error('No autorizado')) };
    const agent = request.agent(createApp(createIdentityRouter(identity, options),
      createMembershipRouter(identity, memberships, options)));
    const pre = await agent.get('/api/v1/auth/csrf').expect(200);
    const login = await agent.post('/api/v1/auth/login').set('Origin', origin)
      .set('X-CSRF-Token', pre.body.csrfToken)
      .send({ email: 'cliente@example.test', password: 'contrasena-ficticia' }).expect(200);
    expect(JSON.stringify(login.body)).not.toMatch(/contrasena-ficticia|token|cookie|membership/i);
    expect(JSON.stringify(login.body)).not.toContain(sessionSecret);
    const csrf = await agent.get('/api/v1/auth/csrf').expect(200);
    const denied = await agent.put('/api/v1/me/active-pharmacy').set('Origin', origin)
      .set('X-CSRF-Token', csrf.body.csrfToken)
      .send({ pharmacyId: '00000000-0000-4000-8000-00000000000b' }).expect(404);
    expect(JSON.stringify(denied.body)).not.toMatch(/00000000-0000-4000-8000-00000000000b|cliente@example.test|token|cookie/i);
  });
});
