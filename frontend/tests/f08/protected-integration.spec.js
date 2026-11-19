import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

test('sin sesión, reservas ofrece acceso sin revelar datos privados', async ({ page }) => {
  const sessionStatuses = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/auth/session')) sessionStatuses.push(response.status());
  });
  await page.goto('/reservations');
  await expect(page.getByText(/Inicia sesión para consultar tus reservas/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mis reservas' })).toHaveCount(0);
  expect(sessionStatuses).toContain(401);
});

test('cuenta TEST selecciona Alfa, ve inventario autorizado y Beta se deniega', async ({ page }) => {
  const email = process.env.F02_DEMO_OWNER_EMAIL;
  const password = process.env.F02_DEMO_OWNER_PASSWORD;
  const beta = process.env.F02_DEMO_BETA_ID;
  if (!email || !password || !beta) throw new Error('F08: credenciales ficticias locales TEST requeridas');
  await page.goto('/identity');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await form.getByLabel('Correo electrónico').fill(email);
  await form.getByLabel('Contraseña').fill(password);
  await form.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  await expect(page.getByText(/Correo de tu perfil/)).toBeVisible();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await page.getByRole('link', { name: 'Inventario', exact: true }).click();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(page.getByRole('heading', { name: 'Catálogo e inventario de la farmacia' })).toBeVisible();
  const result = await page.evaluate(async pharmacyId => {
    const response = await fetch(`/api/v1/farmacias/${pharmacyId}/inventario`, { credentials: 'same-origin' });
    return { status: response.status, body: await response.text() };
  }, beta);
  expect(result.status).toBe(404);
  expect(result.body).not.toContain('Farmacia Beta');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Acceso a FarmaFind' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Catálogo e inventario de la farmacia' })).toHaveCount(0);
});
