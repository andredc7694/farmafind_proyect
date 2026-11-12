import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export interface MigrationClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}

export interface MigrationFile {
  readonly filename: string;
  readonly sql: string;
}

export interface MigrationResult {
  readonly applied: string[];
  readonly skipped: string[];
}

const migrationDirectory = fileURLToPath(new URL('../../../../../migrations/f01/', import.meta.url));

function validateTestUrl(connectionString: string): URL {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error('F01_TEST_DATABASE_URL: URL inválida');
  }
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' ||
      !/^\/farmafind_f01_test(?:_[a-f0-9]{12})?$/.test(url.pathname) || !url.username || !url.password) {
    throw new Error('F01: migraciones limitadas a base de prueba ficticia en loopback');
  }
  if (url.username === 'f01_runtime') throw new Error('F01: rol runtime no puede ejecutar migraciones');
  return url;
}

/** All files and tracking rows are committed together or rolled back together. */
export async function applyMigrationFiles(client: MigrationClient, files: readonly MigrationFile[]): Promise<MigrationResult> {
  const applied: string[] = [];
  const skipped: string[] = [];
  await client.query('BEGIN');
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS f01');
    await client.query(`CREATE TABLE IF NOT EXISTS f01.schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const existing = await client.query('SELECT filename FROM f01.schema_migrations');
    const known = new Set(existing.rows.map(row => String(row.filename)));
    for (const file of files) {
      if (!/^\d{3}_[a-z0-9_]+\.sql$/.test(file.filename)) throw new Error('F01: nombre de migración inválido');
      if (known.has(file.filename)) {
        skipped.push(file.filename);
        continue;
      }
      await client.query(file.sql);
      await client.query('INSERT INTO f01.schema_migrations(filename) VALUES ($1)', [file.filename]);
      applied.push(file.filename);
    }
    if (known.has('003_rls_base.sql') || applied.includes('003_rls_base.sql')) {
      const role = await client.query("SELECT rolsuper, rolbypassrls, rolcanlogin FROM pg_roles WHERE rolname='f01_runtime'");
      if (role.rows.length !== 1 || role.rows[0].rolsuper !== false || role.rows[0].rolbypassrls !== false || role.rows[0].rolcanlogin !== false) {
        throw new Error('F01: rol runtime ausente o privilegiado');
      }
    }
    await client.query('COMMIT');
    return { applied, skipped };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

/** Connection creation is injected so the migration core cannot read a real credential store. */
export async function migrateTestDatabase(
  connectionString: string,
  connect: (url: string) => Promise<MigrationClient>,
): Promise<MigrationResult> {
  const url = validateTestUrl(connectionString);
  const client = await connect(connectionString);
  try {
    const identity = await client.query('SELECT current_database() AS database, current_user AS role');
    if (identity.rows[0]?.database !== url.pathname.slice(1) || identity.rows[0]?.role === 'f01_runtime') {
      throw new Error('F01: identidad o base de migración no autorizada');
    }
    const filenames = readdirSync(migrationDirectory).filter(name => name.endsWith('.sql')).sort();
    if (filenames.length === 0) throw new Error('F01: no hay migraciones');
    const files = filenames.map(filename => ({
      filename,
      sql: readFileSync(new URL(`../../../../../migrations/f01/${filename}`, import.meta.url), 'utf8'),
    }));
    return await applyMigrationFiles(client, files);
  } finally {
    await client.end();
  }
}
