import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const state = JSON.parse(readFileSync(path.join(root, '.cache/f01-demo/state.local.json'), 'utf8'));
if (state.kind !== 'F01_TEST_DEMO_ONLY') throw new Error('Fixture F01 DEMO inválido');
for (const key of ['multi', 'alfa']) {
  if (!state.accounts?.[key]?.email || !state.accounts?.[key]?.password) throw new Error(`Cuenta ficticia ${key} ausente`);
}
if (!state.pharmacies?.beta) throw new Error('Farmacia Beta ficticia ausente');
const values = {
  F01_E2E_CONTAINER: '1',
  F01_DEMO_MULTI_EMAIL: state.accounts.multi.email,
  F01_DEMO_MULTI_PASSWORD: state.accounts.multi.password,
  F01_DEMO_ALFA_EMAIL: state.accounts.alfa.email,
  F01_DEMO_ALFA_PASSWORD: state.accounts.alfa.password,
  F01_DEMO_BETA_ID: state.pharmacies.beta,
};
for (const value of Object.values(values)) if (typeof value !== 'string' || /[\r\n]/.test(value)) throw new Error('Valor privado F01 inválido');
const directory = path.join(root, '.cache/f01-e2e');
mkdirSync(directory, { recursive: true });
writeFileSync(path.join(directory, 'vars.local.env'), Object.entries(values).map(([key, value]) => `${key}=${value}`).join('\n') + '\n', { mode: 0o600 });
console.log('Entorno F01 E2E preparado en archivo local ignorado; no se imprimieron credenciales.');
