/**
 * Ayuda para la DEMO F01.1: calcula el código de 6 dígitos (TOTP, RFC 6238) de una clave de prueba en base32,
 * para quien no tenga aplicación de autenticación a mano. Solo datos ficticios de TEST.
 * Uso: node scripts/f011/totp.mjs <clave-base32>
 */
import { createHmac } from 'node:crypto';

const secret = (process.argv[2] ?? '').replace(/\s+/g, '').toUpperCase();
if (!/^[A-Z2-7]{16,64}$/.test(secret)) { console.error('Uso: node scripts/f011/totp.mjs <clave-base32>'); process.exit(1); }
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
let bits = 0; let value = 0; const bytes = [];
for (const char of secret) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { bytes.push((value >>> (bits - 8)) & 255); bits -= 8; } }
const step = Math.floor(Date.now() / 30000);
for (const [label, offset] of [['código actual', 0], ['código siguiente (úsalo si el actual ya se usó)', 1]]) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step + offset));
  const mac = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const at = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[at] & 0x7f) << 24) | (mac[at + 1] << 16) | (mac[at + 2] << 8) | mac[at + 3];
  console.log(`${label}: ${String(binary % 1_000_000).padStart(6, '0')}`);
}
console.log(`El código cambia cada 30 segundos (quedan ${30 - (Math.floor(Date.now() / 1000) % 30)} s para el actual).`);
