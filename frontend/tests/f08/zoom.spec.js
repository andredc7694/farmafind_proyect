import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { test, expect } from '../../../tests/bootstrap/browser-fixture.mjs';

const extension = path.resolve('frontend/tests/f08/zoom-extension');

test('zoom real de Chromium al 200 % conserva las rutas principales', async ({ services }) => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const page = await context.newPage();
    for (const [route, heading] of [
      ['', 'Encuentra información para'],
      ['search', 'Buscar medicamentos'],
      ['identity', 'Identidad'],
      ['reservations', 'Reservas'],
      ['inventory', 'Inventario'],
      ['search/mapa', 'Farmacias cercanas'],
      ['assistant/conversation', 'FarmaFind AI'],
    ]) {
      await page.goto(`${services.url('frontend')}${route}`);
      const result = await worker.evaluate(async url => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(item => item.url === url);
        if (!tab) throw new Error(`Pestaña F08 no encontrada: ${url}`);
        await chrome.tabs.setZoomSettings(tab.id, { mode: 'automatic', scope: 'per-tab' });
        await chrome.tabs.setZoom(tab.id, 2);
        return chrome.tabs.getZoom(tab.id);
      }, page.url());
      expect(result).toBe(2);
      await expect(page.getByRole('main')).toContainText(heading);
      const dimensions = await page.evaluate(() => ({
        width: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.width, `zoom de navegador en ${route || '/'}`).toBeLessThan(1280);
      expect(dimensions.scrollWidth, `desbordamiento en ${route || '/'}`).toBeLessThanOrEqual(dimensions.width + 1);
      const interactive = await page.locator('main a:visible, main button:visible, main input:visible, main select:visible, main textarea:visible').count();
      expect(interactive, `controles visibles en ${route || '/'}`).toBeGreaterThan(0);
      const clippedControls = await page.locator('main a:visible, main button:visible, main input:visible, main select:visible, main textarea:visible').evaluateAll(items =>
        items.filter(item => { const rect = item.getBoundingClientRect(); return rect.left < -1 || rect.right > window.innerWidth + 1; })
          .map(item => item.textContent?.trim() || item.getAttribute('aria-label') || item.tagName));
      expect(clippedControls, `controles recortados en ${route || '/'}`).toEqual([]);
      const violations = (await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()).violations.filter(item => item.impact === 'critical' || item.impact === 'serious');
      expect(violations, `axe al 200 % en ${route || '/'}`).toEqual([]);
      if (route === 'search') {
        await page.getByLabel('Nombre comercial o principio activo').fill('producto ficticio');
        await expect(page.getByLabel('Nombre comercial o principio activo')).toHaveValue('producto ficticio');
      }
      if (route === 'assistant/conversation') {
        await page.getByLabel('¿Qué información deseas consultar?').fill('Consulta ficticia');
        await expect(page.getByLabel('¿Qué información deseas consultar?')).toHaveValue('Consulta ficticia');
      }
    }
    await page.goto(`${services.url('frontend')}search`);
    await page.getByRole('link', { name: 'Saltar al contenido' }).focus();
    await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
    await page.getByLabel('Nombre comercial o principio activo').fill('producto ficticio');
    await expect(page.getByLabel('Nombre comercial o principio activo')).toHaveValue('producto ficticio');
  } finally {
    await context.close();
  }
});
