import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const dir = new URL('../../migrations/f07/', import.meta.url);
const sql = (name: string) => readFileSync(new URL(name, dir), 'utf8').replaceAll('\r\n', '\n');
const sha = (name: string) => createHash('sha256').update(sql(name)).digest('hex').toUpperCase();

describe('F07.1 · migraciones aprobadas (sin base de datos)', () => {
  it('la carpeta F07 tiene exactamente las ocho migraciones aprobadas', () => {
    expect(readdirSync(dir).filter(file => file.endsWith('.sql')).sort()).toEqual([
      '001_location.sql', '002_location_rls.sql', '003_public_projection.sql', '004_public_proximity.sql',
      '005_review_publication.sql', '006_review_audit.sql', '007_platform_location_review.sql', '008_opening_hours.sql']);
  });

  it('007 y 008 coinciden con los hashes aprobados por Andre el 2026-11-26', () => {
    expect(sha('007_platform_location_review.sql')).toBe('6D7E0C118858D9160EEB3479241B00A0674DCE86CD227FB314F55967063BB0F9');
    expect(sha('008_opening_hours.sql')).toBe('0A6EB089740950D3AD1B31FB9FAC8E3FAB4CF58D76AB6CC1EC0C3D2FC26D2EBF');
  });

  it('son aditivas: no borran ni alteran políticas, no usan BYPASSRLS ni el esquema f025', () => {
    for (const name of ['007_platform_location_review.sql', '008_opening_hours.sql']) {
      const text = sql(name).replace(/--[^\n]*/g, '');
      expect(text).not.toMatch(/\b(DROP|ALTER)\s+POLICY\b/i);
      expect(text).not.toMatch(/\bDROP\s+(TABLE|FUNCTION|CONSTRAINT|TRIGGER)\b/i);
      expect(text).not.toMatch(/\bBYPASSRLS\b(?<!NOBYPASSRLS)/);
      expect(text).not.toMatch(/\bf025\./);
      expect(text).not.toMatch(/\bTRUNCATE\b|\bDELETE\s+FROM\b/i);
    }
  });

  it('las funciones SECURITY DEFINER pertenecen a roles internos sin BYPASSRLS', () => {
    const review = sql('007_platform_location_review.sql');
    expect(review).toMatch(/CREATE ROLE f071_policy NOLOGIN NOSUPERUSER NOBYPASSRLS/);
    expect(review).toContain('ALTER FUNCTION f07.location_actor() OWNER TO f071_policy;');
    expect(review).toContain('ALTER FUNCTION f07.can_platform_location_review(uuid) OWNER TO f071_policy;');
    expect(sql('008_opening_hours.sql')).toContain('ALTER FUNCTION f07.public_opening_hours(uuid[]) OWNER TO f03_projection_owner;');
  });
});
