import { test, expect } from '@playwright/test';

const multi = { email: process.env.F01_DEMO_MULTI_EMAIL, password: process.env.F01_DEMO_MULTI_PASSWORD };
const alfa = { email: process.env.F01_DEMO_ALFA_EMAIL, password: process.env.F01_DEMO_ALFA_PASSWORD };
const betaId = process.env.F01_DEMO_BETA_ID;

async function login(page, account) {
  await page.getByLabel('Correo electrónico').last().fill(account.email);
  await page.getByLabel('Contraseña').last().fill(account.password);
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.goto('http://127.0.0.1:5173/identity'); });

test('registro genérico, sesión, perfil, selector múltiple y cierre', async ({ page }) => {
  const email = `f01-e2e-${Date.now()}@example.test`;
  await page.getByLabel('Correo electrónico').first().fill(email);
  await page.getByLabel('Contraseña').first().fill('Ficticia-E2E-2026-Aa1!');
  await page.getByRole('button', { name: 'Crear cuenta' }).click();
  await expect(page.getByText('Solicitud recibida. Si corresponde, ya puedes iniciar sesión.')).toBeVisible();
  await login(page, multi);
  await expect(page.getByText(multi.email)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Farmacia Alfa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Farmacia Beta' })).toBeVisible();
  await page.getByRole('button', { name: 'Farmacia Beta' }).click();
  await expect(page.getByRole('button', { name: 'Farmacia Beta' })).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText('Sesión cerrada.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Acceso a FarmaFind' })).toBeVisible();
});

test('farmacia ajena conocida permanece denegada para una membresía Alfa', async ({ page }) => {
  await login(page, alfa);
  await expect(page.getByRole('button', { name: 'Farmacia Alfa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Farmacia Beta' })).toHaveCount(0);
  const status = await page.evaluate(async pharmacyId => {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }).then(response => response.json());
    return fetch('/api/v1/me/active-pharmacy', { method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf.csrfToken },
      body: JSON.stringify({ pharmacyId }) }).then(response => response.status);
  }, betaId);
  expect(status).toBe(404);
});

test('credenciales incorrectas producen error genérico', async ({ page }) => {
  await page.getByLabel('Correo electrónico').last().fill('cuenta-inexistente@example.test');
  await page.getByLabel('Contraseña').last().fill('Incorrecta-Aa1!');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('alert')).toContainText('No se pudo completar la solicitud');
  await expect(page.getByText('cuenta inexistente')).toHaveCount(0);
});
