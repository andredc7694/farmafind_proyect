import { describe, expect, it, vi } from 'vitest';
import type { User } from '../../src/modules/usuarios/domain/identity.js';
import { RegistrationService } from '../../src/modules/usuarios/application/registration.js';
import { DuplicateIdentityError } from '../../src/modules/usuarios/application/ports.js';

const user: User = {
  id: '00000000-0000-4000-8000-000000000001',
  canonicalEmail: 'persona@example.test',
  passwordHash: '$argon2id$hash-ficticio',
  state: 'ACTIVO',
  createdAt: new Date('2026-11-11T00:00:00Z'),
  updatedAt: new Date('2026-11-11T00:00:00Z'),
};

function scenario(existing: User | null = null) {
  const repository = {
    findById: vi.fn(),
    findByCanonicalEmail: vi.fn().mockResolvedValue(existing),
    createCustomer: vi.fn().mockResolvedValue(user),
  };
  const hasher = { hash: vi.fn().mockResolvedValue(user.passwordHash), verify: vi.fn() };
  return { service: new RegistrationService(repository, hasher), repository, hasher };
}

describe('autorregistro ordinario sin membresías ni privilegios', () => {
  it('canonicaliza el correo y crea exclusivamente identidad de cliente con hash', async () => {
    const { service, repository, hasher } = scenario();
    await expect(service.register('  Persona@Example.Test  ', 'contraseña-ficticia')).resolves.toBeUndefined();
    expect(repository.findByCanonicalEmail).toHaveBeenCalledWith('persona@example.test');
    expect(repository.createCustomer).toHaveBeenCalledExactlyOnceWith({
      canonicalEmail: 'persona@example.test', passwordHash: user.passwordHash,
    });
    expect(hasher.hash).toHaveBeenCalledWith('contraseña-ficticia');
  });

  it('no duplica una identidad existente ni devuelve información de la cuenta', async () => {
    const { service, repository } = scenario(user);
    await expect(service.register('persona@example.test', 'otra-contraseña-ficticia')).resolves.toBeUndefined();
    expect(repository.createCustomer).not.toHaveBeenCalled();
  });

  it('traduce una carrera de unicidad a la misma salida genérica', async () => {
    const { service, repository } = scenario();
    repository.createCustomer.mockRejectedValueOnce(new DuplicateIdentityError());
    await expect(service.register('persona@example.test', 'contraseña-ficticia')).resolves.toBeUndefined();
  });

  it('rechaza entradas malformadas antes de consultar identidad', async () => {
    const { service, repository } = scenario();
    await expect(service.register('sin-correo', 'contraseña')).rejects.toThrow('Entrada inválida');
    await expect(service.register('a@example.test', '')).rejects.toThrow('Entrada inválida');
    expect(repository.findByCanonicalEmail).not.toHaveBeenCalled();
  });

  it('no reactiva por autorregistro a una identidad inactiva', async () => {
    const inactive = { ...user, state: 'INACTIVO' as const };
    const { service, repository } = scenario(inactive);
    await expect(service.register('persona@example.test', 'contraseña-ficticia')).resolves.toBeUndefined();
    expect(repository.createCustomer).not.toHaveBeenCalled();
  });
});
