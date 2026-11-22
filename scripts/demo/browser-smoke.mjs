/** Chrome browser smoke for the manual DEMO; no import or reservation is committed. */
import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
const credentials = JSON.parse(readFileSync(new URL('../../.cache/manual-demo/credentials.local.json', import.meta.url), 'utf8'));
const base = 'http://127.0.0.1:5173';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
try {
  const pharmacyContext = await browser.newContext();
  const page = await pharmacyContext.newPage();
  await page.goto(`${base}/identity`);
  const login = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Iniciar sesión' }) });
  await login.getByLabel('Correo electrónico').fill(credentials.adminAlfa.email);
  await login.getByLabel('Contraseña').fill(credentials.adminAlfa.password);
  await login.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('heading', { name: 'Sesión activa' }).waitFor();
  await page.getByRole('button', { name: 'Farmacia Alfa DEMO' }).click();
  await page.goto(`${base}/inventory`);
  await page.getByRole('button', { name: 'Farmacia Alfa DEMO' }).click();
  await page.getByRole('heading', { name: 'Importar inventario' }).waitFor();
  assert.equal(await page.getByRole('link', { name: 'Descargar plantilla CSV de demostración' }).count(), 1);
  const price = `12.${String(randomInt(10, 99)).padStart(2, '0')}`;
  const csv = `nombre,concentracion,presentacion,clasificacion,precio,cantidad\nproducto demo a,10 mg,tabletas,venta libre,${price},${randomInt(1, 10000)}\n`;
  await page.locator('#inventory-file').setInputFiles({ name: 'browser-smoke.csv',
    mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
  await page.getByRole('button', { name: 'Preparar vista previa' }).click();
  try { await page.getByRole('heading', { name: 'Vista previa: VISTA_PREVIA' }).waitFor({ timeout: 8000 }); }
  catch (error) {
    const alerts = await page.locator('main [role="alert"]').allTextContents();
    throw new Error(`Vista previa CSV no disponible: ${alerts.join(' | ') || 'sin alerta visible'}`, { cause: error });
  }
  assert.match(await page.getByRole('heading', { name: 'Importar inventario' }).locator('..').innerText(), /1 filas; 0 incidencias/);
  await page.goto(`${base}/reservations`);
  await page.getByRole('button', { name: 'Farmacia Alfa DEMO' }).click();
  await page.getByRole('heading', { name: 'Cola de la farmacia' }).waitFor();
  const clientContext = await browser.newContext();
  const clientPage = await clientContext.newPage();
  await clientPage.goto(`${base}/identity`);
  const clientLogin = clientPage.locator('form').filter({ has: clientPage.getByRole('heading', { name: 'Iniciar sesión' }) });
  await clientLogin.getByLabel('Correo electrónico').fill(credentials.cliente.email);
  await clientLogin.getByLabel('Contraseña').fill(credentials.cliente.password);
  await clientLogin.getByRole('button', { name: 'Iniciar sesión' }).click();
  await clientPage.getByRole('heading', { name: 'Sesión activa' }).waitFor();
  await clientPage.goto(`${base}/search`);
  await clientPage.getByLabel('Nombre comercial o principio activo').fill('producto demo');
  await clientPage.getByRole('button', { name: 'Buscar', exact: true }).click();
  await clientPage.getByText('Sin ofertas publicadas').waitFor();
  await clientPage.goto(`${base}/mapa`);
  await clientPage.getByLabel('Ciudad').fill('lima');
  await clientPage.getByRole('button', { name: 'Buscar farmacias' }).click();
  await clientPage.getByRole('heading', { name: 'Farmacia Alfa DEMO' }).waitFor();
  await clientPage.goto(`${base}/reservations`);
  await clientPage.getByRole('heading', { name: 'FarmaFind — Reservas' }).waitFor();
  console.log('Chrome DEMO: login cliente/farmacia, inventario/vista previa CSV, cola de reservas, búsqueda vacía y mapa verificados; importación no confirmada.');
} finally { await browser.close(); }
