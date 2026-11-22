/** Writes only synthetic FIX-01 browser inputs to the Git-ignored local cache. */
import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(root, '.cache/f02-fixture/state.local.json'), 'utf8'));
assert.equal(fixture.kind, 'F02_FIX01_TEST_ONLY');
assert.match(fixture.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
function entry(name, value) {
  assert.equal(typeof value, 'string', `F02: falta ${name} ficticio`);
  assert(value.length > 0 && !/[\r\n=]/.test(value), `F02: ${name} invÃ¡lido`);
  return `${name}=${value}`;
}
const lines = [
  'F02_E2E_CONTAINER=1',
  entry('F02_DEMO_OWNER_EMAIL', fixture.users.ownerA.email),
  entry('F02_DEMO_OWNER_PASSWORD', fixture.users.ownerA.password),
  entry('F02_DEMO_BETA_ID', fixture.pharmacies.beta),
];
const directory = path.join(root, '.cache/f02-e2e');
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, 'vars.local.env'), `${lines.join('\n')}\n`, { mode: 0o600 });
console.log('F02: variables ficticias de navegador en .cache/f02-e2e/vars.local.env (ignorado por Git).');
