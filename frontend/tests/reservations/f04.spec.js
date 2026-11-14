import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    return ['127.0.0.1', 'localhost'].includes(hostname) ? route.continue() : route.abort();
  });
});

test('cliente y farmacia recorren los estados autorizados de una reserva', async ({ page }) => {
  const pharmacyId = '10000000-0000-4000-8000-000000000001';
  const medicationId = '20000000-0000-4000-8000-000000000001';
  const reservations = [];
  let sequence = 0;

  await page.route('**/api/v1/**', async route => {
    const request = route.request();
    const { pathname } = new URL(request.url());
    const method = request.method();
    const json = data => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });

    if (pathname === '/api/v1/auth/session' && method === 'GET') {
      return json({ email: 'cliente.demo@farmafind.test' });
    }
    if (pathname === '/api/v1/auth/csrf' && method === 'GET') {
      return json({ csrfToken: 'csrf-ficticio-e2e' });
    }
    if (pathname === '/api/v1/me/memberships' && method === 'GET') {
      return json([{ pharmacyId, pharmacyName: 'Farmacia Alfa' }]);
    }
    if (pathname === '/api/v1/me/active-pharmacy' && method === 'PUT') {
      return json({ pharmacyId });
    }
    if (pathname === '/api/v1/reservas' && method === 'GET') {
      return json(reservations);
    }
    if (pathname === '/api/v1/reservas' && method === 'POST') {
      const body = request.postDataJSON();
      sequence += 1;
      const reservation = {
        id: `30000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
        pharmacyId: body.pharmacyId,
        medicationId: body.medicationId,
        quantity: body.quantity,
        state: 'PENDIENTE',
        pickupExpiresAt: null,
      };
      reservations.push(reservation);
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify(reservation),
      });
    }
    if (pathname === `/api/v1/farmacias/${pharmacyId}/reservas/configuracion` && method === 'GET') {
      return json({ pickupWindowHours: 4 });
    }
    if (pathname === `/api/v1/farmacias/${pharmacyId}/reservas` && method === 'GET') {
      return json(reservations);
    }

    const reservationId = pathname.split('/').at(-2);
    const reservation = reservations.find(item => item.id === reservationId);
    if (reservation && pathname.endsWith('/confirmar') && method === 'POST') {
      reservation.state = 'CONFIRMADA';
      reservation.pickupExpiresAt = '2026-11-14T20:00:00.000Z';
      return json(reservation);
    }
    if (reservation && pathname.endsWith('/entregar') && method === 'POST') {
      reservation.state = 'ENTREGADA';
      return json(reservation);
    }
    if (reservation && pathname.endsWith('/cancelar') && method === 'POST') {
      reservation.state = 'CANCELADA';
      return json(reservation);
    }

    return route.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });

  await page.goto('/reservations');
  await expect(page.getByRole('heading', { name: 'FarmaFind — Reservas' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();

  await page.getByLabel('Identificador del medicamento').fill(medicationId);
  await page.getByLabel('Cantidad').fill('2');
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  await expect(page.getByRole('heading', { name: 'Mis reservas' }).locator('..')).toContainText('PENDIENTE');

  // La cola se carga al montar el panel; una recarga representa la consulta posterior de la farmacia.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  const pharmacyQueue = page.getByRole('heading', { name: 'Cola de la farmacia' }).locator('..');
  await expect(pharmacyQueue).toContainText('PENDIENTE');
  await pharmacyQueue.getByRole('button', { name: 'Confirmar' }).click();
  await expect(pharmacyQueue).toContainText('CONFIRMADA');
  await expect(pharmacyQueue).toContainText('vence');
  await pharmacyQueue.getByRole('button', { name: 'Entregar' }).click();
  await expect(pharmacyQueue).toContainText('ENTREGADA');

  await page.getByLabel('Identificador del medicamento').fill(medicationId);
  await page.getByLabel('Cantidad').fill('1');
  await page.getByRole('button', { name: 'Solicitar reserva' }).click();
  const ownReservations = page.getByRole('heading', { name: 'Mis reservas' }).locator('..');
  await ownReservations.getByRole('button', { name: 'Cancelar' }).click();
  await expect(ownReservations).toContainText('CANCELADA');
});
