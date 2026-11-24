import { describe, expect, it } from 'vitest';
import { canonicalAlias, classifyLoginIdentifier } from '../../src/modules/usuarios/domain/alias.js';

describe('F01.1 alias de personal', () => {
  it('normaliza a minúsculas y recorta espacios', () => {
    expect(canonicalAlias('  Alfa.Caja1 ')).toBe('alfa.caja1');
  });

  it.each(['ab', 'a'.repeat(41), '-alfa', '.alfa', 'alfa caja', 'alfa@caja', 'caja#1', '', 'ñandú', 'alfa/caja'])(
    'rechaza el alias inválido %j', value => {
      expect(() => canonicalAlias(value)).toThrow('Entrada inválida');
    });

  it.each([undefined, null, 42, {}, []])('rechaza un valor que no es texto: %j', value => {
    expect(() => canonicalAlias(value)).toThrow('Entrada inválida');
  });

  it('acepta los límites de longitud (3 y 40)', () => {
    expect(canonicalAlias('abc')).toBe('abc');
    expect(canonicalAlias('a'.repeat(40))).toHaveLength(40);
  });

  it('distingue correo de alias al iniciar sesión', () => {
    expect(classifyLoginIdentifier('Dueno@Example.test')).toEqual({ kind: 'email', value: 'dueno@example.test' });
    expect(classifyLoginIdentifier('alfa.caja1')).toEqual({ kind: 'alias', value: 'alfa.caja1' });
  });

  it('rechaza correos mal formados y alias inválidos como identificador', () => {
    for (const bad of ['@', 'a@b', 'sin arroba@x.y', 'ab', null, 7]) {
      expect(() => classifyLoginIdentifier(bad)).toThrow('Entrada inválida');
    }
  });
});
