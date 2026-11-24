import { describe, expect, it } from 'vitest';
import { base32Encode, generateTotpSecret, otpauthUri, totpCode, totpStep, verifyTotp } from '../../src/modules/usuarios/domain/totp.js';

// Vectores oficiales de RFC 6238, apéndice B (HMAC-SHA1, secreto ASCII de 20 bytes, 8 dígitos).
const rfcSecret = Buffer.from('12345678901234567890', 'ascii');
const vectors: Array<[number, string]> = [
  [59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'],
  [1234567890, '89005924'], [2000000000, '69279037'], [20000000000, '65353130'],
];

describe('F01.1 TOTP RFC 6238', () => {
  it.each(vectors)('coincide con el vector oficial en T=%i', (seconds, expected) => {
    expect(totpCode(rfcSecret, totpStep(seconds * 1000), 8)).toBe(expected);
  });

  it('genera códigos de 6 dígitos y secretos de 160 bits', () => {
    expect(totpCode(rfcSecret, 1)).toMatch(/^[0-9]{6}$/);
    expect(generateTotpSecret()).toHaveLength(20);
    expect(() => generateTotpSecret(() => Buffer.alloc(10))).toThrow();
  });

  it('codifica en base32 según RFC 4648', () => {
    expect(base32Encode(Buffer.from('12345678901234567890', 'ascii'))).toBe('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ');
  });

  it('acepta el código vigente y la ventana ±1, y rechaza fuera de ella', () => {
    const now = 1_700_000_000_000; const step = totpStep(now);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step), now, null)).toEqual({ valid: true, step });
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 1), now, null)).toEqual({ valid: true, step: step - 1 });
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step + 1), now, null)).toEqual({ valid: true, step: step + 1 });
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step - 2), now, null).valid).toBe(false);
    expect(verifyTotp(rfcSecret, totpCode(rfcSecret, step + 2), now, null).valid).toBe(false);
  });

  it('rechaza reutilizar un paso ya consumido o anterior', () => {
    const now = 1_700_000_000_000; const step = totpStep(now);
    const code = totpCode(rfcSecret, step);
    expect(verifyTotp(rfcSecret, code, now, step).valid).toBe(false);
    expect(verifyTotp(rfcSecret, code, now, step + 5).valid).toBe(false);
    expect(verifyTotp(rfcSecret, code, now, step - 1)).toEqual({ valid: true, step });
  });

  it('rechaza entradas con formato inválido', () => {
    const now = 1_700_000_000_000;
    for (const bad of [undefined, null, 123456, '12345', '1234567', 'abcdef', ' 123456', '12 456']) {
      expect(verifyTotp(rfcSecret, bad, now, null).valid).toBe(false);
    }
  });

  it('un secreto distinto no valida el código', () => {
    const now = 1_700_000_000_000;
    const other = Buffer.from('ABCDEFGHIJKLMNOPQRST', 'ascii');
    expect(verifyTotp(other, totpCode(rfcSecret, totpStep(now)), now, null).valid).toBe(false);
  });

  it('construye el URI de aprovisionamiento con emisor y parámetros', () => {
    const uri = otpauthUri('admin.ficticio', 'FarmaFind TEST', rfcSecret);
    expect(uri).toMatch(/^otpauth:\/\/totp\/FarmaFind%20TEST%3Aadmin\.ficticio\?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ/);
    expect(uri).toContain('digits=6');
    expect(uri).toContain('period=30');
  });
});
