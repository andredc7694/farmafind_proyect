import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

test('búsqueda F03 muestra únicamente tres ofertas TEST reales y permite comparar', async ({ page }) => {
  await page.goto('/search');
  await page.getByLabel('Nombre comercial o principio activo').fill('producto');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.offer-grid > .offer')).toHaveCount(3);
  await expect(page.getByText('Farmacia Alfa Centro').first()).toBeVisible();
  await expect(page.getByText('Farmacia Beta Centro').first()).toBeVisible();
  await page.getByLabel('Comparar esta oferta').nth(0).check();
  await page.getByLabel('Comparar esta oferta').nth(1).check();
  await expect(page.getByRole('region', { name: 'Comparación de ofertas' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Comparación de ofertas' }).locator('article')).toHaveCount(2);
});

test('búsqueda sin coincidencias no inventa inventario ni muestra un error de servicio', async ({ page }) => {
  await page.goto('/search');
  await page.getByLabel('Nombre comercial o principio activo').fill('sincoincidenciasf08');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.getByText('Sin ofertas publicadas')).toBeVisible();
  await expect(page.locator('.offer-grid > .offer')).toHaveCount(0);
  await expect(page.getByText(/no está disponible temporalmente/i)).toHaveCount(0);
});

test('mapa F07 TEST conserva lista pública sin permiso de ubicación ni teselas', async ({ page }) => {
  const external = [];
  page.on('request', request => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) external.push(request.url());
  });
  await page.goto('/mapa');
  await expect(page.getByText(/únicamente en el entorno TEST\/DEMO/)).toBeVisible();
  await page.getByLabel('Ciudad').fill('Lima');
  await page.getByRole('button', { name: 'Buscar farmacias' }).click();
  await expect(page.locator('.offer-grid > .offer')).toHaveCount(4);
  await expect(page.getByText('Farmacia Alfa Centro')).toBeVisible();
  expect(external).toEqual([]);
});
