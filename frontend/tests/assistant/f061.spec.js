// 2026-11-25: las páginas /assistant y /assistant/conversation se retiraron (el asistente es la burbuja flotante).
// El recorrido vigente está en frontend/e2e/f081-experience.spec.js. Se conserva como referencia y no se ejecuta.
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.skip(true, 'Pantallas retiradas el 2026-11-25');
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

async function ask(page, query) {
  await page.getByLabel('¿Qué información deseas consultar?').fill(query);
  await page.getByRole('button', { name: 'Consultar', exact: true }).click();
}

test('ruta F06 histórica enlaza F06.1 y conversación de seis turnos se recupera', async ({ page }) => {
  await page.goto('/assistant');
  await expect(page.getByRole('heading', { name: 'Asistente informativo' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir el asistente conversacional' }).click();
  await expect(page.getByRole('heading', { name: 'Asistente conversacional informativo' })).toBeVisible();
  for (let turn = 1; turn <= 6; turn += 1) {
    await ask(page, 'Ayuda');
    await expect(page.getByRole('region', { name: `Respuesta ${turn}` })).toBeVisible();
  }
  await ask(page, 'Ayuda');
  await expect(page.getByRole('alert')).toContainText('conversación venció');
  await ask(page, 'Ayuda');
  await expect(page.getByRole('region', { name: 'Respuesta 7' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  expect(await page.context().cookies()).toEqual([]);
});

test('expiración real del servidor tras quince minutos simulados', async ({ page, request }) => {
  await page.goto('/assistant/conversation');
  await ask(page, 'Ayuda');
  await expect(page.getByRole('region', { name: 'Respuesta 1' })).toBeVisible();
  const advance = await request.post('/api/v1/__test/clock/advance', { data: { milliseconds: 900_001 } });
  expect(advance.status()).toBe(204);
  await ask(page, '¿y sus advertencias?');
  await expect(page.getByRole('alert')).toContainText('conversación venció');
});

test('oferta F03 sintética, rechazo clínico y fallo recuperable sin fuga', async ({ page }) => {
  await page.goto('/assistant/conversation');
  await ask(page, 'busca Producto ficticio');
  await expect(page.getByText(/Farmacia Alfa TEST/)).toBeVisible();
  await expect(page.getByText(/precio referencial 1200/)).toBeVisible();
  await ask(page, '¿Qué dosis debo tomar?');
  await expect(page.getByText(/No puedo diagnosticar/)).toBeVisible();
  await ask(page, 'Simular fallo técnico TEST');
  await expect(page.getByRole('alert')).toContainText('no está disponible');
  await expect(page.getByRole('link', { name: 'Ir a búsqueda pública' })).toHaveAttribute('href', '/search');
  await expect(page.locator('body')).not.toContainText('TEST_ONLY_PROVIDER_FAILURE');
});

test('formulario accesible por teclado y en viewport móvil', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/assistant/conversation');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.getByLabel('¿Qué información deseas consultar?')).toBeVisible();
  await page.getByLabel('¿Qué información deseas consultar?').focus();
  await page.keyboard.type('Ayuda');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Consultar' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'Respuesta 1' })).toBeVisible();
});
