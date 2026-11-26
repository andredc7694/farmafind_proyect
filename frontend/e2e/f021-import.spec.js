/** F02.1 browser acceptance: synthetic data and an isolated TEST fixture only. */
import { test, expect } from '@playwright/test';
import ExcelJS from '@excel.js/exceljs';
import { randomUUID } from 'node:crypto';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.describe.configure({ mode: 'serial' });

async function enterInventory(page) {
  const email = process.env.F02_DEMO_OWNER_EMAIL;
  const password = process.env.F02_DEMO_OWNER_PASSWORD;
  if (!email || !password) throw new Error('Credenciales TEST locales requeridas');
  await page.route('**/*', route => {
    const host = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(host) ? route.continue() : route.abort();
  });
  await page.goto('/inventory');
  const login = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await login.getByLabel('Correo electrónico').fill(email);
  await login.getByLabel('Contraseña').fill(password);
  await login.getByRole('button', { name: 'Iniciar sesión' }).click();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(page.getByRole('heading', { name: 'Importar inventario' })).toBeVisible();
}

/** Enmienda F02.1: al elegir el archivo la vista previa aparece sola (sin «Analizar» ni selección manual). */
async function inspectAndSelect(page, name, buffer) {
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({ name,
    mimeType: name.endsWith('.csv') ? 'text/csv' :
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer });
  await expect(page.getByText('Vista previa: VISTA_PREVIA')).toBeVisible();
  await expect(page.getByRole('button', { name: /Analizar/ })).toHaveCount(0);
}

test('CSV con encabezado desplazado confirma solo tras revisión explícita', async ({ page }) => {
  await enterInventory(page);
  const csv = 'Documento ficticio\n' +
    'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    `producto ficticio,10 mg,tabletas,venta libre,13.00,11,${randomUUID()}\n`;
  await inspectAndSelect(page, 'desplazado.csv', Buffer.from(csv));
  await expect(page.getByText('0 incidencias.')).toBeVisible();
  await page.getByLabel('Nombre del perfil de columnas').fill(`Perfil TEST ${randomUUID()}`);
  await page.getByRole('button', { name: 'Guardar perfil para esta farmacia' }).click();
  await expect(page.getByLabel('Nombre del perfil de columnas')).toHaveValue('');
  await page.getByRole('button', { name: 'Confirmar archivo completo' }).click();
  await expect(page.getByText(/Importación confirmada/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'S/ 13.00' }).first()).toBeVisible();
  await page.goto('/search');
  await page.getByLabel('Nombre comercial o principio activo').fill('producto ficticio');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.offer').filter({ hasText: 'S/ 13.00' })).toContainText('Farmacia Alfa');
  await expect(page.locator('.offer').filter({ hasText: 'S/ 13.00' })).toBeVisible();
  await expect(page.locator('.offer').filter({ hasText: 'S/ 13.00' })).not.toContainText('cantidad_fisica');
});

test('precio y cantidad vacíos muestran dos incidencias y bloquean confirmación', async ({ page }) => {
  await enterInventory(page);
  const csv = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    `producto ficticio,10 mg,tabletas,venta libre,,,${randomUUID()}\n`;
  await inspectAndSelect(page, 'errores.csv', Buffer.from(csv));
  await expect(page.getByText('2 incidencias.')).toBeVisible();
  await expect(page.getByText(/campo precioReferencial/)).toBeVisible();
  await expect(page.getByText(/campo cantidadFisica/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar archivo completo' })).toBeDisabled();
  const corrected = 'nombre,concentracion,presentacion,clasificacion,precio,cantidad,nonce\n' +
    `producto ficticio,10 mg,tabletas,venta libre,15.00,13,${randomUUID()}\n`;
  await inspectAndSelect(page, 'corregido.csv', Buffer.from(corrected));
  await expect(page.getByText('0 incidencias.')).toBeVisible();
});

test('XLSX mult hoja exige elegir la hoja de inventario', async ({ page }) => {
  await enterInventory(page);
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Notas').addRow(['Archivo ficticio']);
  const inventory = workbook.addWorksheet('Inventario');
  inventory.addRow(['Encabezado informativo']);
  inventory.addRow(['nombre', 'concentracion', 'presentacion', 'clasificacion', 'precio', 'cantidad']);
  inventory.addRow(['producto ficticio', '10 mg', 'tabletas', 'venta libre', 14, 12]);
  await inspectAndSelect(page, 'multihoja.xlsx',
    Buffer.from(await workbook.xlsx.writeBuffer()));
  await expect(page.getByText('0 incidencias.')).toBeVisible();
});

test('ante una ambigüedad real pregunta solo por ese dato', async ({ page }) => {
  await enterInventory(page);
  const csv = 'Medicamento,Nombre,Concentración,Presentación,Clasificación,Precio,Stock,nonce\n' +
    `producto ficticio,producto ficticio,10 mg,tabletas,venta libre,16.00,14,${randomUUID()}\n`;
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({ name: 'ambiguo.csv',
    mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText(/más de una columna posible para «Producto»/)).toBeVisible();
  await expect(page.getByText('Vista previa: VISTA_PREVIA')).toHaveCount(0);
  await page.getByLabel('Producto', { exact: true }).selectOption('Medicamento');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByText('Vista previa: VISTA_PREVIA')).toBeVisible();
});

test('un archivo que no se puede abrir explica la causa y la solución', async ({ page }) => {
  await enterInventory(page);
  await page.getByLabel('Archivo CSV o XLSX').setInputFiles({ name: 'roto.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('no es un libro') });
  await expect(page.getByRole('alert').filter({ hasText: 'No se pudo abrir el archivo' }).first()).toBeVisible();
  await expect(page.getByText('No se pudo completar la solicitud.')).toHaveCount(0);
});
