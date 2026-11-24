/**
 * URL administrativa de pruebas RLS: SIEMPRE un fixture marcado TEST (farmafind_f01_test_<12 hex>).
 * Nunca la base persistente farmafind_f01_test. Las credenciales salen de .cache (ignorado por Git).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

export function fixtureAdminUrl(root = process.cwd()) {
  const state = JSON.parse(readFileSync(path.join(root, '.cache/f02-fixture/state.local.json'), 'utf8'));
  assert.equal(state.kind, 'F02_FIX01_TEST_ONLY', 'Fixture TEST no marcado');
  assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/, 'Nombre de fixture inválido');
  const secret = readFileSync(path.join(root, '.cache/f01-docker/postgres-password.txt'), 'utf8').trim();
  assert.match(secret, /^[a-f0-9]{64}$/i, 'Secreto PostgreSQL local inválido');
  const url = new URL(`postgresql://127.0.0.1:55431/${state.database}`);
  url.username = 'f01_migrator';
  url.password = secret;
  return url.toString();
}
