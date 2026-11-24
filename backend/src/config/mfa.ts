/**
 * Clave de cifrado del secreto TOTP (F011-FR-012). Debe venir de configuración externa
 * (en TEST, un archivo ignorado por Git bajo .cache); nunca se registra ni se versiona.
 */
export function loadMfaKey(env: Record<string, string | undefined>): Buffer {
  const value = env.F01_MFA_KEY_HEX ?? '';
  if (!/^[0-9a-f]{64}$/i.test(value)) {
    throw new Error('F01_MFA_KEY_HEX: se requieren exactamente 32 bytes hexadecimales (64 caracteres)');
  }
  const key = Buffer.from(value, 'hex');
  if (key.every(byte => byte === key[0])) throw new Error('F01_MFA_KEY_HEX: clave degenerada');
  return key;
}
