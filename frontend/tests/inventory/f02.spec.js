/** Mandatory browser acceptance on an officially Playwright-supported OS only. */
import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });

async function enterOwner(page) {
  const email = process.env.F02_DEMO_OWNER_EMAIL;
  const password = process.env.F02_DEMO_OWNER_PASSWORD;
  if (!email || !password) throw new Error('F02: credenciales ficticias locales requeridas para aceptación Playwright');
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1','localhost'].includes(host) ? route.continue() : route.abort();
  });
  await page.goto('/inventory');
  const login = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await login.getByLabel('Correo electrónico').fill(email);
  await login.getByLabel('Contraseña').fill(password);
  await login.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo e inventario de la farmacia' })).toBeVisible();
}

test('revisión manual, vista previa, confirmación e historial F02', async ({ page }) => {
  await enterOwner(page);
  await page.getByLabel('Medicamento').selectOption({ index: 1 });
  await page.getByLabel('Precio referencial (S/)').fill('12.50');
  await page.getByLabel('Cantidad física revisada').fill('9');
  await page.getByLabel('Motivo de revisión').fill('Conteo ficticio en navegador');
  await page.getByRole('button', { name: 'Guardar revisión' }).click();
  await expect(page.getByText('Conteo ficticio en navegador')).toBeVisible();

  const csv = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    `producto ficticio,10 mg,tabletas,venta libre,13.00,10,${randomUUID()}\n`;
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({
    name: 'inventario-ficticio.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Preparar vista previa' }).click();
  await expect(page.getByText('Vista previa: VISTA_PREVIA')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar archivo completo' }).click();
  await expect(page.getByText(/CONFIRMADA/)).toBeVisible();
});

test('archivo inválido no habilita confirmación y Beta no revela inventario', async ({ page }) => {
  await enterOwner(page);
  const csv = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    `producto ficticio,10 mg,tabletas,venta libre,-1,2,${randomUUID()}\n`;
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({
    name: 'inventario-invalido.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  await page.getByRole('button', { name: 'Preparar vista previa' }).click();
  await expect(page.getByText(/VALOR_INVALIDO/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar archivo completo' })).toBeDisabled();

  const beta = process.env.F02_DEMO_BETA_ID;
  if (!beta) throw new Error('F02: identificador ficticio de Beta requerido');
  const result = await page.evaluate(async pharmacyId => {
    const response = await fetch(`/api/v1/farmacias/${pharmacyId}/inventario`, { credentials: 'same-origin' });
    return { status: response.status, body: await response.text() };
  }, beta);
  expect(result.status).toBe(404);
  expect(result.body).not.toContain('Farmacia Beta');
});

test('un conflicto en la segunda fila revierte la primera y rechaza el archivo', async ({ page }) => {
  const fixture = JSON.parse(readFileSync(new URL('../../../.cache/f02-fixture/state.local.json', import.meta.url), 'utf8'));
  expect(fixture.kind).toBe('F02_FIX01_TEST_ONLY');
  expect(fixture.database).toMatch(/^farmafind_f01_test_[a-f0-9]{12}$/);
  const localPassword = readFileSync(new URL('../../../.cache/f01-docker/postgres-password.txt', import.meta.url), 'utf8').trim();
  expect(localPassword).toMatch(/^[a-f0-9]{64}$/i);
  const database = new Client({ connectionString:
    `postgresql://f01_migrator:${localPassword}@127.0.0.1:55431/${fixture.database}` });
  await database.connect();
  let references;
  try {
    references = (await database.query(`SELECT id,nombre,concentracion,presentacion,clasificacion
      FROM f02.medicamento ORDER BY id`)).rows;
    expect(references).toHaveLength(2);
    const later = references[1];
    await database.query(`INSERT INTO f02.inventario
      (farmacia_id,medicamento_id,precio_centavos,cantidad_fisica,cantidad_comprometida,ultima_revision_at)
      VALUES($1,$2,100,1,1,now())
      ON CONFLICT(farmacia_id,medicamento_id) DO UPDATE SET
        cantidad_fisica=GREATEST(f02.inventario.cantidad_fisica,1),cantidad_comprometida=1`,
    [fixture.pharmacies.alfa, later.id]);
  } finally { await database.end(); }

  await enterOwner(page);
  const snapshot = async () => page.evaluate(async ({ pharmacyId, medicationId }) => {
    const [inventory, movements] = await Promise.all([
      fetch(`/api/v1/farmacias/${pharmacyId}/inventario`, { credentials: 'same-origin' }).then(r => r.json()),
      fetch(`/api/v1/farmacias/${pharmacyId}/inventario/movimientos`, { credentials: 'same-origin' }).then(r => r.json()),
    ]);
    return { row: inventory.find(item => item.medicamentoId === medicationId) ?? null,
      movementCount: movements.filter(item => item.medicamento_id === medicationId).length };
  }, { pharmacyId: fixture.pharmacies.alfa, medicationId: references[0].id });
  const before = await snapshot();
  const csv = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    references.map((item, index) =>
      `${item.nombre},${item.concentracion},${item.presentacion},${item.clasificacion},${index ? '2.00,0' : '3.00,7'},${randomUUID()}\n`).join('');
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({
    name: 'conflicto-ficticio.csv', mimeType: 'text/csv', buffer: Buffer.from(csv),
  });
  const previewResponse = page.waitForResponse(response =>
    response.url().includes('/vista-previa') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Preparar vista previa' }).click();
  const preview = await (await previewResponse).json();
  expect(preview.errores).toHaveLength(0);
  await page.getByRole('button', { name: 'Confirmar archivo completo' }).click();
  await expect(page.getByRole('alert')).toContainText('Los datos cambiaron');
  expect(await snapshot()).toEqual(before);
  const status = await page.evaluate(async ({ pharmacyId, importId }) =>
    fetch(`/api/v1/farmacias/${pharmacyId}/importaciones/${importId}`, { credentials: 'same-origin' })
      .then(response => response.json()),
  { pharmacyId: fixture.pharmacies.alfa, importId: preview.importacionId });
  expect(status.estado).toBe('RECHAZADA');
});
