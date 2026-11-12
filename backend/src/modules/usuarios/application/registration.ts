import { DuplicateIdentityError } from './ports.js';
import type { PasswordHasher, UserRepository } from './ports.js';

export function canonicalEmail(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Entrada inválida');
  const email = value.trim().toLowerCase();
  if (email.length < 3 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    throw new Error('Entrada inválida');
  }
  return email;
}

/** Registers only an ordinary customer identity; membership grants use another gated flow. */
export class RegistrationService {
  constructor(private readonly users: UserRepository, private readonly passwords: PasswordHasher) {}

  async register(emailInput: unknown, passwordInput: unknown): Promise<void> {
    const email = canonicalEmail(emailInput);
    if (typeof passwordInput !== 'string' || passwordInput.length === 0) throw new Error('Entrada inválida');
    const passwordHash = await this.passwords.hash(passwordInput);
    const existing = await this.users.findByCanonicalEmail(email);
    if (existing) return;
    try {
      await this.users.createCustomer({ canonicalEmail: email, passwordHash });
    } catch (error) {
      if (!(error instanceof DuplicateIdentityError)) throw error;
    }
  }
}
