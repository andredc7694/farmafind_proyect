/** F08.1 — recorridos de navegador de los cinco actores sobre un fixture TEST efímero con datos ficticios (T019). */
import { test, expect } from '@playwright/test';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block', screenshot: 'only-on-failure' });
test.describe.configure({ mode: 'serial', timeout: 120000 });

const env = name => { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}`); return value; };
const account = prefix => ({ email: env(`F081_${prefix}_EMAIL`), password: env(`F081_${prefix}_PASSWORD`) });
const owner = account('OWNER'); const ownerB = account('OWNER_B'); const worker = account('WORKER'); const reviewer = account('REVIEWER'); const client = account('CLIENT');
const alfaId = env('F081_ALFA_ID');
const betaId = env('F081_BETA_ID');

async function newPage(browser, options = {}) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block', ...options });
  const page = await context.newPage();
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  return { context, page };
}
async function open(page, path) { try { await page.goto(path); } catch { await page.goto(path); } }
async function login(page, who) {
  await open(page, '/identity');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await form.getByLabel('Usuario o correo electrónico').fill(who.email);
  await form.getByLabel('Contraseña').fill(who.password);
  await form.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
}
const status = (page, url) => page.evaluate(async target => (await fetch(target, { credentials: 'same-origin' })).status, url);
const menu = page => page.getByRole('navigation', { name: 'Navegación principal' });
const theme = page => page.evaluate(() => document.documentElement.getAttribute('data-theme'));

test('visitante: menú público mínimo, tema que se recuerda, búsqueda con sugerencias y comparables, y chat flotante', async ({ browser }) => {
  const { page, context } = await newPage(browser);
  await open(page, '/');
  for (const label of ['Inicio', 'Buscar medicamentos', 'Farmacias cercanas', 'Mi cuenta']) await expect(menu(page).getByRole('link', { name: label })).toBeVisible();
  for (const label of ['Mis reservas', 'Panel de farmacia', 'Ubicación de farmacia', 'Revisar solicitudes']) await expect(menu(page).getByRole('link', { name: label })).toHaveCount(0);
  // Tema: se aplica al instante y se recuerda tras recargar (sin sesión: solo en el navegador).
  await page.getByLabel('Tema').selectOption('OSCURO');
  expect(await theme(page)).toBe('dark');
  await page.reload();
  expect(await theme(page)).toBe('dark'); await expect(page.getByLabel('Tema')).toHaveValue('OSCURO');
  // Búsqueda con sugerencias: teclado para elegir, y buscar es una acción aparte.
  await open(page, '/search');
  const field = page.getByLabel('Nombre comercial o principio activo');
  await field.fill('para');
  await expect(page.getByRole('listbox', { name: 'Sugerencias' }).getByRole('option').first()).toBeVisible({ timeout: 10000 });
  await field.press('ArrowDown'); await field.press('Enter');
  await expect(field).toHaveValue(/paracetamol ficticio/);
  await expect(page.locator('.offer')).toHaveCount(0); // elegir una sugerencia no busca por sí sola
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await expect(page.locator('.offer').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/También en: Farmacia/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ver farmacias en el mapa' })).toBeVisible();
  expect(page.url()).toContain('q=paracetamol');
  // Chat flotante: preguntas sugeridas solo rellenan; enviar da una respuesta informativa; Escape minimiza.
  await page.getByRole('button', { name: /Preguntar a FarmaFind AI/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.locator('.chat-suggestions button').first().click();
  await expect(dialog.getByLabel('Tu consulta')).not.toHaveValue('');
  await expect(dialog.locator('.chat-answer')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Enviar' }).click();
  await expect(dialog.locator('.chat-answer')).toHaveCount(1, { timeout: 20000 });
  await expect(dialog.getByText(/diagnósticos, tratamientos, recetas ni dosis/)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Preguntar a FarmaFind AI \(1\)/ })).toBeFocused();
  await context.close();
});

test('teclado y móvil: foco visible y ordenado en los flujos públicos, sin desplazamiento horizontal a 360 px', async ({ browser }) => {
  const { page, context } = await newPage(browser, { viewport: { width: 360, height: 740 } });
  for (const path of ['/', '/search', '/mapa', '/identity']) {
    await open(page, path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `desplazamiento horizontal en ${path}`).toBeLessThanOrEqual(1);
  }
  await open(page, '/search');
  await page.keyboard.press('Tab'); // primer destino: «Saltar al contenido»
  expect(await page.evaluate(() => document.activeElement?.textContent?.trim())).toBe('Saltar al contenido');
  const seen = [];
  for (let step = 0; step < 14; step++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement; if (!el || el === document.body) return null;
      const style = getComputedStyle(el); const rect = el.getBoundingClientRect();
      return { label: (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).trim().slice(0, 40), outline: style.outlineStyle, width: parseFloat(style.outlineWidth), visible: rect.width > 0 && rect.height > 0, tabindex: el.tabIndex };
    });
    expect(info, `paso ${step}`).not.toBeNull();
    expect(info.visible, info.label).toBe(true);
    expect(info.outline !== 'none' && info.width >= 2, `foco no visible en «${info.label}»`).toBe(true);
    expect(info.tabindex, info.label).toBeGreaterThanOrEqual(0);
    seen.push(info.label);
  }
  expect(new Set(seen).size).toBeGreaterThan(8); // recorre controles distintos (sin trampa de foco)
  await context.close();
});

test('cliente: ve su cuenta y sus reservas, nunca paneles de farmacia, y su tema viaja con su perfil', async ({ browser }) => {
  const first = await newPage(browser);
  await login(first.page, client);
  await expect(menu(first.page).getByRole('link', { name: 'Mis reservas' })).toBeVisible();
  await expect(menu(first.page).getByRole('link', { name: 'Panel de farmacia' })).toHaveCount(0);
  await first.page.getByLabel('Tema').selectOption('OSCURO');
  await expect.poll(async () => (await first.page.evaluate(async () => (await (await fetch('/api/v1/me/profile', { credentials: 'same-origin' })).json()).theme))).toBe('OSCURO');
  await first.context.close();
  // Otro navegador (sin nada guardado): al iniciar sesión el perfil manda y el tema oscuro se aplica solo.
  const second = await newPage(browser);
  await login(second.page, client);
  await expect.poll(() => theme(second.page)).toBe('dark');
  await expect(second.page.getByLabel('Tema')).toHaveValue('OSCURO');
  expect(await status(second.page, `/api/v1/farmacias/${alfaId}/reservas/resumen`)).toBe(403);
  await second.context.close();
});

test('trabajador: usa lo que se le delegó (F01.2) y el servidor deniega lo demás aunque se escriba la ruta', async ({ browser }) => {
  const { page, context } = await newPage(browser);
  await login(page, worker);
  await expect(menu(page).getByRole('link', { name: 'Panel de farmacia' })).toBeVisible();
  await open(page, '/farmacias/panel');
  const sections = page.getByRole('navigation', { name: 'Secciones de la farmacia' });
  await expect(sections.getByRole('button')).toHaveText(['Resumen', 'Inventario', 'Reservas', 'Historial']);
  await expect(page.getByText('Productos en inventario')).toBeVisible();
  await expect(page.getByText('Pendientes de responder')).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'No tienes autorización para ver estas cifras.' })).toHaveCount(0);
  expect(await status(page, `/api/v1/pharmacies/${alfaId}/staff`)).toBe(403);
  expect(await status(page, `/api/v1/farmacias/${alfaId}/reservas/resumen`)).toBe(200);
  expect(await status(page, `/api/v1/farmacias/${alfaId}/inventario/resumen`)).toBe(200);
  expect(await status(page, `/api/v1/farmacias/${betaId}/reservas/resumen`)).toBe(403);
  await context.close();
});

test('propietario: ocho secciones en orden, resumen de su farmacia, historial y personal; Beta no ve Alfa', async ({ browser }) => {
  const { page, context } = await newPage(browser);
  await login(page, owner);
  await open(page, '/farmacias/panel');
  const sections = page.getByRole('navigation', { name: 'Secciones de la farmacia' });
  await expect(sections.getByRole('button')).toHaveText(['Resumen', 'Farmacia y ubicación', 'Inventario', 'Importar', 'Reservas', 'Historial', 'Personal', 'Configuración']);
  await expect(page.getByText('Pendientes de responder')).toBeVisible();
  await expect(page.getByText('Productos en inventario')).toBeVisible();
  await expect(page.locator('.summary-grid').first()).toContainText('0'); // aún sin reservas
  await sections.getByRole('button', { name: 'Historial' }).click();
  await expect(page.getByRole('form', { name: 'Filtros del historial' })).toBeVisible();
  await sections.getByRole('button', { name: 'Personal' }).click();
  await expect(page.getByRole('heading', { name: 'Personal de la farmacia' })).toBeVisible();
  await sections.getByRole('button', { name: 'Configuración' }).click();
  await expect(page.getByLabel(/Plazo de recogida/)).toBeVisible();
  const other = await newPage(browser);
  await login(other.page, ownerB);
  await open(other.page, '/farmacias/panel');
  await expect(other.page.getByRole('heading', { name: 'Panel de farmacia' })).toBeVisible();
  await expect(other.page.getByText('Farmacia Alfa')).toHaveCount(0);
  for (const path of [`/api/v1/farmacias/${alfaId}/reservas/resumen`, `/api/v1/farmacias/${alfaId}/inventario/resumen`, `/api/v1/pharmacies/${alfaId}/staff`]) {
    expect(await status(other.page, path), path).not.toBe(200);
  }
  await other.context.close(); await context.close();
});

test('revisor de ubicaciones: ve solo lo suyo y el servidor deniega personal y reservas', async ({ browser }) => {
  const { page, context } = await newPage(browser);
  await login(page, reviewer);
  await expect(menu(page).getByRole('link', { name: 'Ubicación de farmacia' })).toBeVisible();
  await expect(menu(page).getByRole('link', { name: 'Panel de farmacia' })).toHaveCount(0);
  await open(page, '/farmacias/panel');
  await expect(page.getByRole('navigation', { name: 'Secciones de la farmacia' }).getByRole('button')).toHaveText(['Farmacia y ubicación']);
  expect(await status(page, `/api/v1/pharmacies/${alfaId}/staff`)).toBe(403);
  expect(await status(page, `/api/v1/farmacias/${alfaId}/reservas/resumen`)).toBe(403);
  expect(await status(page, `/api/v1/farmacias/${alfaId}/inventario/resumen`)).not.toBe(200);
  await context.close();
});

test('propietario: elegir el punto con la ubicación del dispositivo (una vez, con permiso) o escribirlo; el mapa pide consentimiento', async ({ browser }) => {
  const { page, context } = await newPage(browser, { permissions: ['geolocation'], geolocation: { latitude: -12.0555, longitude: -77.0444 } });
  await login(page, owner);
  await open(page, '/farmacias/panel');
  await page.getByRole('navigation', { name: 'Secciones de la farmacia' }).getByRole('button', { name: 'Farmacia y ubicación' }).click();
  await expect(page.getByRole('heading', { name: 'Ubicación pública de la farmacia' })).toBeVisible();
  await expect(page.getByText(/verá tu dirección IP/)).toBeVisible();
  await expect(page.getByRole('application')).toHaveCount(0); // el mapa no se carga hasta consentir
  await page.getByRole('button', { name: 'Usar mi ubicación una vez' }).click();
  await expect(page.getByLabel('Latitud')).toHaveValue(/^-12\.055/);
  await expect(page.getByLabel('Longitud')).toHaveValue(/^-77\.044/);
  await expect(page.getByText(/No se guarda como rastro/)).toBeVisible();
  expect(await page.evaluate(() => Object.keys(window.localStorage))).not.toContain('ff-location');
  await expect(page.getByLabel(/Confirmo que la dirección pública y el punto/)).toBeVisible();
  await context.close();
});
