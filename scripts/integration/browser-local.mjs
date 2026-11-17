/** Optional real Chrome smoke against the isolated TEST API and a loopback Vite proxy. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const state = JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json', import.meta.url), 'utf8'));
assert.equal(state.kind, 'F03_TEST_ONLY');
assert.match(state.database, /^farmafind_f01_test_[a-f0-9]{12}$/);
const port = Number(process.env.FARMAFIND_LOCAL_WEB_PORT ?? '5173');
assert(Number.isInteger(port) && port >= 1024 && port <= 65535);
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('response', response => {
    if (response.url().includes('/api/v1/auth/')) console.log(`Auth HTTP ${response.status()} ${new URL(response.url()).pathname}`);
  });
  await page.route('**/*', route => {
    if (new URL(route.request().url()).hostname !== '127.0.0.1') return route.abort();
    // The temporary parallel Vite instance uses 5174; the approved normal origin is 5173.
    if (port !== 5173 && route.request().url().includes('/api/v1/') &&
        !['GET', 'HEAD'].includes(route.request().method())) {
      return route.fetch({ headers: { ...route.request().headers(), origin: 'http://127.0.0.1:5173' } })
        .then(response => route.fulfill({ response }));
    }
    return route.continue();
  });
  await page.goto(`${base}/search`);
  await page.locator('#public-query').fill('paracetamol');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('link', { name: 'Solicitar reserva' }).first().waitFor();
  const reservationLink = await page.getByRole('link', { name: 'Solicitar reserva' }).first().getAttribute('href');
  assert(reservationLink?.startsWith('/reservations?pharmacyId='));
  await page.goto(`${base}/assistant`);
  await page.locator('#assistant-query').fill('¿Qué dosis de paracetamol debo tomar?');
  await page.getByRole('button', { name: 'Consultar' }).click();
  await page.getByRole('heading', { name: 'Respuesta' }).waitFor();
  assert.match(await page.locator('#assistant-answer + p').first().innerText(), /No puedo diagnosticar/i);
  await page.goto(`${base}/reservations`);
  await page.getByRole('heading', { name: 'Acceso a FarmaFind' }).waitFor();
  const email = `browser-${randomUUID()}@example.invalid`;
  const password = `Aa1!${randomBytes(24).toString('hex')}`;
  await page.locator('#register-email').fill(email);
  await page.locator('#register-password').fill(password);
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await page.getByRole('status').filter({ hasText: 'Solicitud recibida' }).waitFor();
  await page.locator('#login-email').fill(email);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: 'Sesión activa' }).waitFor();
  await page.getByRole('heading', { name: 'Mis reservas' }).waitFor();
  await page.getByText('No tienes farmacias disponibles.').waitFor();
  await page.goto(`${base}${reservationLink}`);
  await page.getByRole('heading', { name: 'Mis reservas' }).waitFor();
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  await page.getByRole('heading', { name: 'Mis reservas' }).locator('..').getByText('PENDIENTE').waitFor();
  console.log('Chrome TEST: búsqueda, rechazo clínico, registro, login y reserva sin membresía: correctos.');
  await context.close();
} finally { await browser.close(); }
