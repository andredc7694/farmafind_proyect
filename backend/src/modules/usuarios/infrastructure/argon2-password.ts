import argon2 from 'argon2';
import type { PasswordHasher } from '../application/ports.js';

/** Explicit Argon2id parameters exceed the current OWASP minimum. */
const parameters = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 1,
});

export class Argon2PasswordHasher implements PasswordHasher {
  async hash(plainText: string): Promise<string> {
    if (plainText.length === 0) throw new Error('Contraseña inválida');
    return argon2.hash(plainText, parameters);
  }

  async verify(storedHash: string, plainText: string): Promise<boolean> {
    if (!storedHash.startsWith('$argon2id$') || plainText.length === 0) return false;
    try {
      return await argon2.verify(storedHash, plainText);
    } catch {
      return false;
    }
  }

  needsRehash(storedHash: string): boolean {
    if (!storedHash.startsWith('$argon2id$')) return true;
    try {
      return argon2.needsRehash(storedHash, parameters);
    } catch {
      return true;
    }
  }
}
