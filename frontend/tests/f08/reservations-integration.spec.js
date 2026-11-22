import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

test('reserva F04 real TEST: 401, creación, confirmación, vencimiento, entrega y denegaciones', async ({ page }) => {
  const { F04_TEST_OWNER_EMAIL: email, F04_TEST_OWNER_PASSWORD: password,
    F04_TEST_PHARMACY_ID: pharmacyId, F04_TEST_BETA_ID: betaId,
    F04_TEST_MEDICATION_ID: medicationId } = process.env;
  if (![email, password, pharmacyId, betaId, medicationId].every(Boolean)) throw new Error('Fixture F04 TEST incompleta');
  const anonymous = [];
  page.on('response', response => {
    if (response.url().includes('/api/v1/auth/session')) anonymous.push(response.status());
  });
  await page.goto(`/reservations?pharmacyId=${pharmacyId}&medicationId=${medicationId}`);
  await expect(page.getByText(/Inicia sesión para consultar tus reservas/)).toBeVisible();
  expect(anonymous).toContain(401);
  const login = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await login.getByLabel('Correo electrónico').fill(email);
  await login.getByLabel('Contraseña').fill(password);
  await login.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(page.getByRole('heading', { name: 'Cola de la farmacia' })).toBeVisible();
  await expect(page.getByLabel('Identificador del medicamento')).toHaveValue(medicationId);
  const created = page.waitForResponse(response => response.url().endsWith('/api/v1/reservas') &&
    response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  const createdResponse = await created;
  expect(createdResponse.status()).toBe(201);
  const reservationId = (await createdResponse.json()).id;
  const own = page.getByRole('heading', { name: 'Mis reservas' }).locator('..');
  await expect(own).toContainText('PENDIENTE');
  expect(reservationId).toBeTruthy();
  await page.reload();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  const queue = page.getByRole('heading', { name: 'Cola de la farmacia' }).locator('..');
  const card = queue.locator(`[data-reservation-id="${reservationId}"]`);
  await expect(card).toContainText('PENDIENTE');
  await card.getByRole('button', { name: 'Confirmar' }).click();
  await expect(card).toContainText('CONFIRMADA');
  await expect(card).toContainText('vence');
  const denied = await page.evaluate(async ({ pharmacyId: alfa, beta, reservation }) => {
    const betaResponse = await fetch(`/api/v1/farmacias/${beta}/reservas`, { credentials: 'same-origin' });
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }).then(response => response.json());
    const missingCsrf = await fetch(`/api/v1/farmacias/${alfa}/reservas/${reservation}/entregar`, {
      method: 'POST', credentials: 'same-origin', headers: { 'Idempotency-Key': crypto.randomUUID() },
    });
    return { betaStatus: betaResponse.status, betaBody: await betaResponse.text(),
      missingCsrfStatus: missingCsrf.status, hasCsrf: typeof csrf.csrfToken === 'string' };
  }, { pharmacyId, beta: betaId, reservation: reservationId });
  expect(denied.betaStatus).toBe(403);
  expect(denied.betaBody).not.toContain('Farmacia Beta');
  expect(denied.missingCsrfStatus).toBe(403);
  expect(denied.hasCsrf).toBe(true);
  await card.getByRole('button', { name: 'Entregar' }).click();
  await expect(card).toContainText('ENTREGADA');
  const conflict = await page.evaluate(async ({ pharmacyId: alfa, reservation, key }) => {
    const csrf = await fetch('/api/v1/auth/csrf', { credentials: 'same-origin' }).then(response => response.json());
    return fetch(`/api/v1/farmacias/${alfa}/reservas/${reservation}/confirmar`, {
      method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': csrf.csrfToken,
        'Idempotency-Key': key },
    }).then(response => response.status);
  }, { pharmacyId, reservation: reservationId, key: randomUUID() });
  expect(conflict).toBe(409);
});
