import { describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { PgUserRepository, PgSessionRepository } from '../../src/modules/usuarios/infrastructure/identity-repository.js';
import { DuplicateIdentityError } from '../../src/modules/usuarios/application/ports.js';
import type { Session } from '../../src/modules/usuarios/domain/identity.js';

const userId = randomUUID();
const sessionId = randomUUID();
const now = new Date('2026-11-11T12:00:00.000Z');

function client(rows: Record<string, unknown>[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) };
}

describe('repositorios de identidad y sesión con SQL parametrizado', () => {
  it('consulta correo canónico como dato global sin interpolarlo en SQL', async () => {
    const sql = client([{ id: userId, email_canonico: 'a@example.test', password_hash: '$argon2id$fixture', estado: 'ACTIVO', created_at: now, updated_at: now }]);
    const found = await new PgUserRepository(sql).findByCanonicalEmail("a'@example.test");
    expect(found?.id).toBe(userId);
    expect(sql.query.mock.calls[0][0]).toContain('email_canonico=$1');
    expect(sql.query.mock.calls[0][0]).not.toContain("a'@example.test");
    expect(sql.query.mock.calls[0][1]).toEqual(["a'@example.test"]);
  });

  it('crea solo identidad global ordinaria y traduce carrera UNIQUE a error no revelador', async () => {
    const sql = client([{ id: userId, email_canonico: 'a@example.test', password_hash: '$argon2id$fixture', estado: 'ACTIVO', created_at: now, updated_at: now }]);
    const repository = new PgUserRepository(sql);
    await repository.createCustomer({ canonicalEmail: 'a@example.test', passwordHash: '$argon2id$fixture' });
    expect(sql.query.mock.calls[0][0]).toMatch(/^INSERT INTO f01\.usuario/);
    expect(sql.query.mock.calls[0][1]).toEqual(['a@example.test', '$argon2id$fixture']);
    expect(sql.query.mock.calls[0][0]).toContain('ON CONFLICT (email_canonico) DO NOTHING');
    sql.query.mockResolvedValueOnce({ rows: [] });
    await expect(repository.createCustomer({ canonicalEmail: 'a@example.test', passwordHash: '$argon2id$fixture' }))
      .rejects.toBeInstanceOf(DuplicateIdentityError);
  });

  it('guarda huella de sesión, nunca secreto bruto, y revoca por ID parametrizado', async () => {
    const sql = client();
    const repository = new PgSessionRepository(sql);
    const session: Session = {
      id: sessionId, userId, tokenFingerprint: 'a'.repeat(64), state: 'VIGENTE',
      createdAt: now, lastUsedAt: now, idleExpiresAt: new Date(now.getTime() + 30 * 60_000),
      absoluteExpiresAt: new Date(now.getTime() + 8 * 60 * 60_000), revokedAt: null,
    };
    await repository.save(session);
    const args = sql.query.mock.calls[1][1] as unknown[];
    expect(args.some(value => Buffer.isBuffer(value) && value.equals(Buffer.from(session.tokenFingerprint, 'hex')))).toBe(true);
    expect(args).not.toContain('secreto-bruto');
    await repository.revoke(session.tokenFingerprint, now);
    expect(sql.query.mock.calls[3][0]).toContain('WHERE token_fingerprint=$1');
    expect(sql.query.mock.calls[3][1]).toEqual([Buffer.from(session.tokenFingerprint, 'hex'), now]);
  });
});
