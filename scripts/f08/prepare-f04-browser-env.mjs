/** Keep fictional browser credentials and IDs only in ignored .cache. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';

const f02 = JSON.parse(readFileSync('.cache/f02-fixture/state.local.json', 'utf8'));
const f04 = JSON.parse(readFileSync('.cache/f04-fixture/state.local.json', 'utf8'));
assert.equal(f02.kind, 'F02_FIX01_TEST_ONLY');
assert.equal(f04.kind, 'F04_TEST_ONLY');
assert.match(f04.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const entries = {
  F04_TEST_OWNER_EMAIL: f02.users.ownerA.email,
  F04_TEST_OWNER_PASSWORD: f02.users.ownerA.password,
  F04_TEST_PHARMACY_ID: f04.pharmacyId,
  F04_TEST_BETA_ID: f04.betaId,
  F04_TEST_MEDICATION_ID: f04.medicationId,
};
for (const [key, value] of Object.entries(entries)) {
  assert.equal(typeof value, 'string', `Falta ${key}`);
  assert(value.length > 0 && !/[\r\n=]/.test(value), `Valor TEST inválido: ${key}`);
}
writeFileSync('.cache/f04-fixture/browser.local.env',
  `${Object.entries(entries).map(([key, value]) => `${key}=${value}`).join('\n')}\n`, { mode: 0o600 });
console.log('F04: credenciales ficticias de navegador guardadas en .cache ignorada por Git.');
