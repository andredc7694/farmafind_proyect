/** Política mínima de clave definitiva (contrato F01.1: 12 a 128 caracteres). */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

export function validateNewPassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH ||
      value.trim().length === 0) {
    throw new Error('Entrada inválida');
  }
  return value;
}
