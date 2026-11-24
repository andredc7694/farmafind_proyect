import { randomBytes } from 'node:crypto';

/** Clave temporal (F011-FR-002/003): un solo uso, 24 horas, CSPRNG de 160 bits. */
export const TEMPORARY_KEY_TTL_HOURS = 24;
const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32, sin I, L, O ni U.
const keyLength = 32;

export type RandomSource = (size: number) => Buffer;

export function generateTemporaryKey(random: RandomSource = randomBytes): string {
  const bytes = random(keyLength);
  if (bytes.length < keyLength) throw new Error('Fuente aleatoria insuficiente');
  let key = '';
  for (let index = 0; index < keyLength; index++) key += alphabet[bytes[index] & 31];
  return key.match(/.{8}/g)!.join('-');
}

/** Acepta espacios, guiones y minúsculas al digitar; rechaza lo que no pertenezca al alfabeto. */
export function normalizeTemporaryKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const compact = value.replace(/[\s-]/g, '').toUpperCase();
  if (compact.length !== keyLength || ![...compact].every(char => alphabet.includes(char))) return null;
  return compact;
}

export function temporaryKeyExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + TEMPORARY_KEY_TTL_HOURS * 3_600_000);
}

export type TemporaryKeyState = 'VIGENTE' | 'CONSUMIDA' | 'VENCIDA';

export function assessTemporaryKey(input: { consumedAt: Date | null; expiresAt: Date; now: Date }): TemporaryKeyState {
  if (input.consumedAt) return 'CONSUMIDA';
  return input.expiresAt.getTime() > input.now.getTime() ? 'VIGENTE' : 'VENCIDA';
}
