import assert from 'node:assert/strict';
import test from 'node:test';
import { assertF025ConnectedTarget, assertF025EphemeralDatabase,
  F025_CLUSTER_NAME, F025_TEST_MARKER, validateF025TestConfig } from './test-env.mjs';

const database = 'farmafind_f01_test_a1b2c3d4e5f6';
const url = (name = database, role = 'f01_migrator', host = '127.0.0.1', port = '55431') =>
  `postgresql://${role}:synthetic-only@${host}:${port}/${name}`;

test('F02.5 accepts only the named ephemeral local database for migration', () => {
  assert.equal(assertF025EphemeralDatabase(url(), { migration: true }), database);
  assert.equal(assertF025EphemeralDatabase(url(database, 'f025_runtime_test')), database);
  for (const value of [url('farmafind_f01_test'), url('production'), url(database, 'f01_migrator', 'localhost'),
    url(database, 'f01_migrator', 'db.example.test'), url(database, 'f01_migrator', '127.0.0.1', '5432')]) {
    assert.throws(() => assertF025EphemeralDatabase(value, { migration: true }));
  }
  assert.throws(() => assertF025EphemeralDatabase(url(database, 'f025_runtime_test'), { migration: true }));
  assert.throws(() => assertF025EphemeralDatabase(url(database, 'f01_migrator')));
});

test('F02.5 verifies the connected database marker and identity', async () => {
  const client = rows => ({ query: async () => ({ rows }) });
  assert.deepEqual(await assertF025ConnectedTarget(client([{
    database, role: 'f01_migrator', cluster: F025_CLUSTER_NAME, marker: F025_TEST_MARKER,
  }]), database), { database, role: 'f01_migrator' });
  for (const row of [
    { database: 'farmafind_f01_test', role: 'f01_migrator', cluster: F025_CLUSTER_NAME, marker: F025_TEST_MARKER },
    { database, role: 'f01_runtime', cluster: F025_CLUSTER_NAME, marker: F025_TEST_MARKER },
    { database, role: 'f01_migrator', cluster: 'farmafind-f01-postgres', marker: F025_TEST_MARKER },
    { database, role: 'f01_migrator', cluster: F025_CLUSTER_NAME, marker: null },
  ]) await assert.rejects(assertF025ConnectedTarget(client([row]), database));
});

test('F02.5 configuration separates auth and runtime inside one TEST database', () => {
  const config = {
    F025_MIGRATION_DATABASE_URL: url(),
    F025_AUTH_DATABASE_URL: url(database, 'f025_auth_test'),
    F025_RUNTIME_DATABASE_URL: url(database, 'f025_runtime_test'),
  };
  assert.equal(validateF025TestConfig(config).database, database);
  assert.throws(() => validateF025TestConfig({
    ...config, F025_RUNTIME_DATABASE_URL: url('farmafind_f01_test', 'f025_runtime_test'),
  }));
  assert.throws(() => validateF025TestConfig({
    ...config, F025_RUNTIME_DATABASE_URL: config.F025_AUTH_DATABASE_URL,
  }));
});
