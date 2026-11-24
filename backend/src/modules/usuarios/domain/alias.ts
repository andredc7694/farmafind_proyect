/** F011-FR-001: alias interno de personal; nunca se presenta como correo entregable. */
export const aliasPattern = /^[a-z0-9][a-z0-9._-]{2,39}$/;

export function canonicalAlias(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Entrada inválida');
  const alias = value.trim().toLowerCase();
  if (!aliasPattern.test(alias)) throw new Error('Entrada inválida');
  return alias;
}

export type LoginIdentifier =
  | { readonly kind: 'email'; readonly value: string }
  | { readonly kind: 'alias'; readonly value: string };

/** Un identificador con «@» es un correo; si no, un alias. Cualquier otro caso es entrada inválida. */
export function classifyLoginIdentifier(value: unknown): LoginIdentifier {
  if (typeof value !== 'string') throw new Error('Entrada inválida');
  const text = value.trim().toLowerCase();
  if (text.includes('@')) {
    if (text.length < 3 || text.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(text)) throw new Error('Entrada inválida');
    return { kind: 'email', value: text };
  }
  return { kind: 'alias', value: canonicalAlias(text) };
}
