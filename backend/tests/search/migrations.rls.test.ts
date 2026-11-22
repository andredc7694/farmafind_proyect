import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = (name: string) => readFileSync(new URL(`../../migrations/f03/${name}`,import.meta.url),'utf8');
describe('migraciones F03', () => {
  it('son aditivas, fuerzan RLS y no otorgan BYPASSRLS', () => {
    expect(migration('001_public_search.sql')).toContain('ADD COLUMN IF NOT EXISTS principio_activo');
    expect(migration('001_public_search.sql')).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration('002_public_projection.sql')).toContain('NOLOGIN NOSUPERUSER');
    expect(migration('002_public_projection.sql')).toContain('NOBYPASSRLS');
  });
  it('usa funciones fijas y search_path cerrado sin SQL dinámico', () => {
    const sql=migration('002_public_projection.sql');
    expect(sql).toContain('SECURITY DEFINER'); expect(sql).toContain('SET search_path = pg_catalog');
    expect(sql).not.toMatch(/\bEXECUTE\s+format\b/i);
  });
});
