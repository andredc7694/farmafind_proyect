import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { SecretBox } from '../../src/modules/usuarios/infrastructure/secret-box.js';
import { loadMfaKey } from '../../src/config/mfa.js';

const key = randomBytes(32);

describe('F01.1 cifrado del secreto TOTP', () => {
  it('cifra y descifra con el mismo contexto, sin dejar el secreto en claro', () => {
    const box = new SecretBox(key); const secret = randomBytes(20);
    const sealed = box.seal(secret, 'usuario-1');
    expect(sealed.nonce).toHaveLength(12);
    expect(sealed.ciphertext.includes(secret)).toBe(false);
    expect(box.open(sealed, 'usuario-1').equals(secret)).toBe(true);
  });

  it('usa un nonce distinto en cada cifrado', () => {
    const box = new SecretBox(key); const secret = randomBytes(20);
    expect(box.seal(secret, 'u').nonce.equals(box.seal(secret, 'u').nonce)).toBe(false);
  });

  it('rechaza un contexto distinto, una clave distinta y datos manipulados', () => {
    const box = new SecretBox(key); const sealed = box.seal(randomBytes(20), 'usuario-1');
    expect(() => box.open(sealed, 'usuario-2')).toThrow('Secreto inválido');
    expect(() => new SecretBox(randomBytes(32)).open(sealed, 'usuario-1')).toThrow('Secreto inválido');
    const tampered = Buffer.from(sealed.ciphertext); tampered[0] ^= 1;
    expect(() => box.open({ ...sealed, ciphertext: tampered }, 'usuario-1')).toThrow('Secreto inválido');
    expect(() => box.open({ ciphertext: sealed.ciphertext, nonce: randomBytes(8) }, 'usuario-1')).toThrow('Secreto inválido');
  });

  it('exige una clave de 32 bytes', () => {
    expect(() => new SecretBox(randomBytes(16))).toThrow();
  });

  it('valida la configuración F01_MFA_KEY_HEX sin revelar su valor', () => {
    expect(loadMfaKey({ F01_MFA_KEY_HEX: randomBytes(32).toString('hex') })).toHaveLength(32);
    for (const bad of [undefined, '', 'abc', 'zz'.repeat(32), randomBytes(31).toString('hex'), '00'.repeat(32)]) {
      expect(() => loadMfaKey({ F01_MFA_KEY_HEX: bad })).toThrow(/F01_MFA_KEY_HEX/);
    }
    try { loadMfaKey({ F01_MFA_KEY_HEX: 'secreto-que-no-debe-aparecer' }); } catch (error) {
      expect((error as Error).message).not.toContain('secreto-que-no-debe-aparecer');
    }
  });
});
