/** F04.1 — recorridos de navegador sobre un fixture TEST efímero con datos ficticios (T015). */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block', screenshot: 'only-on-failure' });
test.describe.configure({ mode: 'serial', timeout: 180000 });

const env = name => { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}`); return value; };
const owner = { email: env('F041_OWNER_EMAIL'), password: env('F041_OWNER_PASSWORD') };
const ownerB = { email: env('F041_OWNER_B_EMAIL'), password: env('F041_OWNER_B_PASSWORD') };
const client = { email: env('F041_CLIENT_EMAIL'), password: env('F041_CLIENT_PASSWORD') };
const alfaId = env('F041_ALFA_ID'); const medicationId = env('F041_MEDICATION_ID');
const clientPath = `/reservations?pharmacyId=${alfaId}&medicationId=${medicationId}`;
const shared = {};

async function open(page, path = '/reservations') {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  try { await page.goto(path); } catch { await page.goto(path); }
}
async function login(page, account) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await form.getByLabel('Usuario o correo electrónico').fill(account.email);
  await form.getByLabel('Contraseña').fill(account.password);
  await form.getByRole('button', { name: 'Iniciar sesión' }).click();
}
const status = (page, url) => page.evaluate(async target => (await fetch(target, { credentials: 'same-origin' })).status, url);
async function newPage(browser) { const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' }); return { context, page: await context.newPage() }; }
const cards = page => page.locator('[data-reservation-id]');

test('el cliente reserva con preferencia; la cola de la farmacia se actualiza sola y confirmar fija el vencimiento de siempre', async ({ browser }) => {
  const staff = await newPage(browser); shared.staff = staff;
  await open(staff.page); await login(staff.page, owner);
  await staff.page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(staff.page.getByRole('heading', { name: 'Centro de atención' })).toBeVisible();
  await expect(staff.page.getByText('No hay reservas de esta farmacia en este momento.')).toBeVisible();
  await expect(staff.page.getByText(/Se actualiza sola cada 30 s/)).toBeVisible();

  const customer = await newPage(browser); shared.customer = customer;
  await open(customer.page, clientPath); await login(customer.page, client);
  await expect(customer.page.getByRole('heading', { name: 'Solicitar reserva' })).toBeVisible();
  await customer.page.getByLabel('¿Cuándo crees que podrías recoger? (opcional)').selectOption('60');
  await expect(customer.page.getByText(/no es una cita y no cambia el vencimiento/)).toBeVisible();
  await customer.page.getByRole('button', { name: 'Solicitar reserva' }).click();
  const mine = customer.page.getByRole('heading', { name: 'Mis reservas' }).locator('xpath=..');
  await expect(mine.getByText('PENDIENTE')).toBeVisible();
  await expect(mine.getByText('Preferencia estimada: en unos 60 minutos (no es una cita)')).toBeVisible();

  // Sin tocar nada, la farmacia ve la reserva (sondeo de 30 s) con la preferencia como orientación.
  await expect(cards(staff.page)).toHaveCount(1, { timeout: 50000 });
  await expect(cards(staff.page).first().getByText('Preferencia estimada: en unos 60 minutos (no es una cita)')).toBeVisible();
  await expect(cards(staff.page).first().getByText(/producto ficticio 10 mg tabletas/)).toBeVisible();
  await cards(staff.page).first().getByRole('button', { name: 'Confirmar' }).click();
  await expect(staff.page.getByText('Reserva confirmada.')).toBeVisible();
  await expect(cards(staff.page).first().getByText('CONFIRMADA')).toBeVisible({ timeout: 20000 });
  // El vencimiento es confirmación + 4 h (plazo por defecto), sin influencia de la preferencia.
  const rows = await staff.page.evaluate(async id => (await fetch(`/api/v1/farmacias/${id}/reservas`, { credentials: 'same-origin' })).json(), alfaId);
  expect(rows).toHaveLength(1);
  expect(Date.parse(rows[0].pickupExpiresAt) - Date.parse(rows[0].confirmedAt)).toBe(4 * 3600 * 1000);
  expect(rows[0].pickupPreference).toEqual({ type: 'MINUTES', minutes: 60 });
});

test('un corte de red se avisa y, al volver, la lista converge sin duplicados ni acciones automáticas', async () => {
  const { page, context } = shared.staff;
  await context.setOffline(true);
  await expect(page.getByText(/Sin conexión: se reintentará sola/)).toBeVisible({ timeout: 50000 });
  // Mientras tanto otro cliente crea una segunda reserva (sin preferencia).
  const second = await newPage(shared.customer.page.context().browser());
  const secondClient = { email: env('F041_CLIENT2_EMAIL'), password: env('F041_CLIENT2_PASSWORD') };
  await open(second.page, clientPath); await login(second.page, secondClient);
  await second.page.getByRole('button', { name: 'Solicitar reserva' }).click();
  await expect(second.page.getByText('PENDIENTE')).toBeVisible();
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(cards(page)).toHaveCount(2, { timeout: 20000 });
  await expect(page.getByText(/Sin conexión/)).toHaveCount(0);
  const ids = await cards(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('data-reservation-id')));
  expect(new Set(ids).size).toBe(2);
  // El sondeo nunca ejecuta acciones: la segunda reserva sigue pendiente y la primera confirmada.
  await expect(page.locator('[data-reservation-id]', { hasText: 'PENDIENTE' })).toHaveCount(1);
  await expect(page.locator('[data-reservation-id]', { hasText: 'CONFIRMADA' })).toHaveCount(1);
  shared.second = second;
});

test('entregar y cancelar cierran reservas; el historial y el CSV muestran solo la farmacia y sin datos del cliente', async () => {
  const staff = shared.staff.page;
  await staff.locator('[data-reservation-id]', { hasText: 'CONFIRMADA' }).getByRole('button', { name: 'Entregar' }).click();
  await expect(staff.getByText('Entrega registrada.')).toBeVisible();
  // La segunda cliente cancela su reserva pendiente.
  await shared.second.page.reload();
  await shared.second.page.getByRole('button', { name: 'Cancelar reserva' }).click();
  await expect(shared.second.page.getByText('CANCELADA')).toBeVisible();
  await staff.getByRole('tab', { name: 'Historial' }).click();
  await expect(staff.locator('.reservation-queue li')).toHaveCount(2, { timeout: 20000 });
  await expect(staff.locator('.reservation-queue li strong', { hasText: /^Entregada$/ })).toHaveCount(1);
  await expect(staff.locator('.reservation-queue li strong', { hasText: /^Cancelada$/ })).toHaveCount(1);
  await staff.getByLabel('Estado').selectOption('ENTREGADA');
  await staff.getByRole('button', { name: 'Buscar' }).click();
  await expect(staff.locator('.reservation-queue li')).toHaveCount(1);
  await staff.getByLabel('Estado').selectOption('');
  await staff.getByRole('button', { name: 'Buscar' }).click();
  await expect(staff.locator('.reservation-queue li')).toHaveCount(2);
  const [download] = await Promise.all([staff.waitForEvent('download'), staff.getByRole('button', { name: 'Descargar CSV' }).click()]);
  const stream = await download.createReadStream(); const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  const csv = Buffer.concat(chunks).toString('utf8');
  expect(csv).toContain('codigo,estado,medicamento,cantidad,creada,confirmada,vence_recogida,motivo_cierre,preferencia');
  expect(csv).toContain('ENTREGADA'); expect(csv).toContain('CANCELADA'); expect(csv).toContain('no es una cita');
  expect(csv.trim().split('\r\n')).toHaveLength(3);
  for (const secret of [client.email, env('F041_CLIENT2_EMAIL'), 'f041-cliente']) expect(csv).not.toContain(secret);
  await expect(staff.getByText(/sin datos personales/)).toBeVisible();
});

test('aislamiento Alfa/Beta: otra farmacia y un cliente no ven la cola, el historial ni la exportación', async ({ browser }) => {
  const other = await newPage(browser);
  await open(other.page); await login(other.page, ownerB);
  await other.page.getByRole('button', { name: 'Farmacia Beta' }).click();
  await expect(other.page.getByRole('heading', { name: 'Centro de atención' })).toBeVisible();
  await expect(other.page.getByText('No hay reservas de esta farmacia en este momento.')).toBeVisible();
  await expect(cards(other.page)).toHaveCount(0);
  for (const path of ['centro', 'historial', 'historial/exportar']) {
    expect(await status(other.page, `/api/v1/farmacias/${alfaId}/reservas/${path}`), `Beta→Alfa ${path}`).toBe(403);
    expect(await status(shared.customer.page, `/api/v1/farmacias/${alfaId}/reservas/${path}`), `cliente→Alfa ${path}`).toBe(403);
  }
  expect(await status(shared.staff.page, `/api/v1/farmacias/${env('F041_BETA_ID')}/reservas/centro`)).toBe(403);
  await other.context.close(); await shared.second.context.close(); await shared.customer.context.close(); await shared.staff.context.close();
});
