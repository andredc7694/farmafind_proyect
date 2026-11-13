import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

interface MigrationClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  end(): Promise<void>;
}
const directory = fileURLToPath(new URL('../../../../migrations/f03/', import.meta.url));

/** Apply only F03 migrations to an isolated F01/F02-shaped local TEST database. */
export async function migrateF03TestDatabase(urlText: string,
  connect: (url: string) => Promise<MigrationClient>): Promise<readonly string[]> {
  const url = new URL(urlText);
  if (!['postgres:','postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || url.port !== '55431' ||
      !/^\/farmafind_f01_test_[a-f0-9]{12}$/.test(url.pathname) || !url.username || !url.password || url.username === 'f01_runtime') {
    throw new Error('F03: migraciones limitadas a base TEST aislada en loopback');
  }
  const client = await connect(urlText);
  try {
    const identity = await client.query('SELECT current_database() AS database,current_user AS role');
    if (identity.rows[0]?.database !== url.pathname.slice(1) || identity.rows[0]?.role === 'f01_runtime') {
      throw new Error('F03: identidad de migración incorrecta');
    }
    const files = readdirSync(directory).filter(file => /^\d{3}_[a-z0-9_]+\.sql$/.test(file)).sort();
    if (files.length === 0) throw new Error('F03: no hay migraciones');
    await client.query('BEGIN');
    try {
      await client.query('CREATE SCHEMA IF NOT EXISTS f03');
      await client.query(`CREATE TABLE IF NOT EXISTS f03.schema_migrations (
        filename text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())`);
      const known = new Set((await client.query('SELECT filename FROM f03.schema_migrations')).rows.map(row => String(row.filename)));
      const applied: string[] = [];
      for (const file of files) {
        if (known.has(file)) continue;
        await client.query(readFileSync(new URL(`../../../../migrations/f03/${file}`, import.meta.url), 'utf8'));
        await client.query('INSERT INTO f03.schema_migrations(filename) VALUES($1)', [file]);
        applied.push(file);
      }
      await client.query('COMMIT');
      return applied;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  } finally { await client.end(); }
}
