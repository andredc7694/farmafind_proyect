import { describe, expect, it } from 'vitest';
import argon2 from 'argon2';
import { Argon2PasswordHasher } from '../../src/modules/usuarios/infrastructure/argon2-password.js';

const password = 'contraseña-ficticia-para-pruebas';

describe('Argon2id F01 con datos ficticios', () => {
  const hasher = new Argon2PasswordHasher();

  it('genera sal distinta por credencial y formato versionado verificable', async () => {
    const first = await hasher.hash(password);
    const second = await hasher.hash(password);
    expect(first).toMatch(/^\$argon2id\$v=19\$m=65536,t=3,p=1\$/);
    expect(second).not.toBe(first);
    expect(await hasher.verify(first, password)).toBe(true);
    expect(await hasher.verify(second, password)).toBe(true);
    expect(hasher.needsRehash(first)).toBe(false);
  });

  it('deniega contraseña incorrecta y hash inválido sin exponer detalles', async () => {
    const stored = await hasher.hash(password);
    expect(await hasher.verify(stored, 'contraseña-equivocada')).toBe(false);
    expect(await hasher.verify('valor-inválido', password)).toBe(false);
    expect(hasher.needsRehash('valor-inválido')).toBe(true);
  });

  it('detecta parámetros antiguos y rechaza otra variante Argon2', async () => {
    const old = await argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
    expect(await hasher.verify(old, password)).toBe(true);
    expect(hasher.needsRehash(old)).toBe(true);
    const wrongVariant = await argon2.hash(password, { type: argon2.argon2i, memoryCost: 65536, timeCost: 3, parallelism: 1 });
    expect(await hasher.verify(wrongVariant, password)).toBe(false);
    expect(hasher.needsRehash(wrongVariant)).toBe(true);
  });

  it('no crea un hash de contraseña vacía', async () => {
    await expect(hasher.hash('')).rejects.toThrow('Contraseña inválida');
  });
});
