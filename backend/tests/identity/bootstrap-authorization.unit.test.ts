import { createHash, randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
// The operational command remains JavaScript so it can run before compiling the backend.
// @ts-expect-error local operational module intentionally has no declaration file
import { validateBootstrapInput } from '../../../scripts/f01/bootstrap.mjs';

function document(overrides: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    approvalId: randomUUID(), operation: 'INITIAL_PLATFORM_ADMIN', targetUserId: randomUUID(),
    pharmacyId: null, role: 'ADMINISTRADOR_PLATAFORMA', reason: 'Aprobacion humana ficticia',
    expiresAt: new Date(Date.now()+60_000).toISOString(), idempotencyKey: 'fixture-initial-admin-001',
    ...overrides,
  };
  const canonical=JSON.stringify({ approvalId:value.approvalId, operation:value.operation,
    targetUserId:value.targetUserId, pharmacyId:value.pharmacyId ?? null, role:value.role,
    reason:value.reason, expiresAt:value.expiresAt, idempotencyKey:value.idempotencyKey });
  value.integrityHash=createHash('sha256').update(canonical).digest('hex');
  return value;
}

describe('BOOT-01 offline', () => {
  it('acepta solo expediente integro sobre base efimera local', () => {
    expect(validateBootstrapInput('postgresql://fixture:fixture@127.0.0.1:55431/farmafind_f01_test_abcdef123456',
      document()).pathname).toBe('/farmafind_f01_test_abcdef123456');
  });
  it('rechaza base persistente, remota y expediente manipulado', () => {
    expect(() => validateBootstrapInput('postgresql://fixture:fixture@127.0.0.1:55431/farmafind_f01_test',document()))
      .toThrow('efimera');
    expect(() => validateBootstrapInput('postgresql://fixture:fixture@example.test:55431/farmafind_f01_test_abcdef123456',document()))
      .toThrow('efimera');
    const changed=document(); changed.reason='Texto alterado despues de la aprobacion';
    expect(() => validateBootstrapInput('postgresql://fixture:fixture@127.0.0.1:55431/farmafind_f01_test_abcdef123456',changed))
      .toThrow('Integridad');
  });
  it('rechaza rol, ambito y vencimiento incompatibles', () => {
    const url='postgresql://fixture:fixture@127.0.0.1:55431/farmafind_f01_test_abcdef123456';
    expect(() => validateBootstrapInput(url,document({role:'DUENO'}))).toThrow('Rol');
    expect(() => validateBootstrapInput(url,document({expiresAt:new Date(Date.now()-60_000).toISOString()}))).toThrow('invalido');
    expect(() => validateBootstrapInput(url,document({operation:'INITIAL_PHARMACY_OWNER',role:'DUENO',pharmacyId:null})))
      .toThrow('Ambito');
  });
});
