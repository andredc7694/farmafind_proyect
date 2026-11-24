import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** TOTP RFC 6238 con HMAC-SHA1 (F011-FR-012). Sin dependencias externas. */
export const TOTP_PERIOD_SECONDS = 30;
export const TOTP_DIGITS = 6;
export const TOTP_WINDOW = 1;
const base32Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateTotpSecret(random: (size: number) => Buffer = randomBytes): Buffer {
  const secret = random(20);
  if (secret.length < 20) throw new Error('Fuente aleatoria insuficiente');
  return secret;
}

export function base32Encode(bytes: Buffer): string {
  let bits = 0; let value = 0; let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { output += base32Alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) output += base32Alphabet[(value << (5 - bits)) & 31];
  return output;
}

export function totpStep(timeMilliseconds: number): number {
  return Math.floor(timeMilliseconds / 1000 / TOTP_PERIOD_SECONDS);
}

/** HOTP truncado sobre el contador `step` (RFC 4226 §5.3). */
export function totpCode(secret: Buffer, step: number, digits: number = TOTP_DIGITS): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac('sha1', secret).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export type TotpResult = { readonly valid: true; readonly step: number } | { readonly valid: false };

/**
 * Valida un código en la ventana ±1 y rechaza reutilizar un paso ya consumido (`lastUsedStep`).
 * El llamador debe persistir `step` de forma atómica para impedir repeticiones.
 */
export function verifyTotp(secret: Buffer, code: unknown, nowMilliseconds: number, lastUsedStep: number | null): TotpResult {
  if (typeof code !== 'string' || !/^[0-9]{6}$/.test(code)) return { valid: false };
  const current = totpStep(nowMilliseconds);
  let matched: number | null = null;
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = current + offset;
    if (step < 0) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code)) && (matched === null || step > matched)) matched = step;
  }
  if (matched === null || (lastUsedStep !== null && matched <= lastUsedStep)) return { valid: false };
  return { valid: true, step: matched };
}

export function otpauthUri(label: string, issuer: string, secret: Buffer): string {
  const encodedLabel = encodeURIComponent(`${issuer}:${label}`);
  return `otpauth://totp/${encodedLabel}?secret=${base32Encode(secret)}&issuer=${encodeURIComponent(issuer)}` +
    `&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD_SECONDS}`;
}
