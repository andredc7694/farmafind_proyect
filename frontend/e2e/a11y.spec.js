/** Revisión integrada — accesibilidad automatizada (axe) en pantallas clave, tema claro y oscuro, sobre fixture TEST efímero. */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
test.describe.configure({ mode: 'default', timeout: 90000 });

const env = name => { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}`); return value; };
const account = prefix => ({ email: env(`F081_${prefix}_EMAIL`), password: env(`F081_${prefix}_PASSWORD`) });
const owner = account('OWNER'); const client = account('CLIENT');
const report = [];

async function newPage(browser) {
  const context = await browser.newContext({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
  const page = await context.newPage();
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  return { context, page };
}
async function open(page, path) { try { await page.goto(path); } catch { await page.goto(path); } await page.waitForLoadState('load'); await page.waitForTimeout(500); }
async function login(page, who) {
  await open(page, '/identity');
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await form.getByLabel('Usuario o correo electrónico').fill(who.email);
  await form.getByLabel('Contraseña').fill(who.password);
  await form.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
}
async function scan(page, name, mode) {
  console.log('SCAN ' + name + ' ' + mode);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = result.violations.filter(v => ['critical', 'serious'].includes(v.impact));
  report.push({ screen: name, theme: mode, total: result.violations.length, serious: serious.map(v => `${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`),
    others: result.violations.filter(v => !serious.includes(v)).map(v => `${v.id} (${v.impact})`) });
  return serious;
}
async function setTheme(page, value) { const select = page.getByLabel('Tema'); if (await select.first().isVisible()) { await select.first().selectOption(value); await page.waitForTimeout(200); } }

const screens = [
  ['inicio', '/'], ['búsqueda pública', '/search'], ['farmacias cercanas', '/mapa'], ['identidad (entrar)', '/identity'],
];
for (const mode of ['CLARO', 'OSCURO']) {
  test(`axe: pantallas públicas en tema ${mode}`, async ({ browser }) => {
    const { page, context } = await newPage(browser);
    for (const [name, path] of screens) {
      await open(page, path); await setTheme(page, mode);
      const bubble = page.getByRole('button', { name: /Preguntar a FarmaFind AI/ });
      if (name === 'inicio' && await bubble.count()) { await scan(page, 'inicio con burbuja', mode); await bubble.click(); await scan(page, 'chat abierto', mode); await page.keyboard.press('Escape'); }
      const serious = await scan(page, name, mode);
      expect.soft(serious.map(v => v.id), `${name} (${mode})`).toEqual([]);
    }
    await context.close();
  });
  test(`axe: cliente y propietario en tema ${mode}`, async ({ browser }) => {
    const first = await newPage(browser); await login(first.page, client); await setTheme(first.page, mode);
    for (const [name, path] of [['sesión cliente', '/identity'], ['mis reservas', '/reservations']]) {
      await open(first.page, path); await setTheme(first.page, mode);
      expect.soft((await scan(first.page, name, mode)).map(v => v.id), `${name} (${mode})`).toEqual([]);
    }
    await first.context.close();
    const second = await newPage(browser); await login(second.page, owner); await setTheme(second.page, mode);
    await open(second.page, '/farmacias/panel'); await setTheme(second.page, mode);
    expect.soft((await scan(second.page, 'panel de farmacia', mode)).map(v => v.id), `panel (${mode})`).toEqual([]);
    for (const label of ['Inventario', 'Reservas', 'Historial', 'Personal', 'Configuración', 'Farmacia y ubicación']) {
      const tab = second.page.getByRole('navigation', { name: 'Secciones de la farmacia' }).getByRole('button', { name: label });
      if (await tab.count()) { await tab.click(); await second.page.waitForTimeout(400); expect.soft((await scan(second.page, `panel · ${label}`, mode)).map(v => v.id), `${label} (${mode})`).toEqual([]); }
    }
    await second.context.close();
  });
}
test.afterAll(async () => { console.log('AXE_REPORT ' + JSON.stringify(report)); });
