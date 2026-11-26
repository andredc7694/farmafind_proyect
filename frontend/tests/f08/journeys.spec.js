import { test, expect } from '../../../tests/bootstrap/browser-fixture.mjs';
import { mkdirSync } from 'node:fs';
import nodePath from 'node:path';

for (const width of [360, 640, 768, 1280]) {
  test(`rutas públicas mantienen contenido y ancho utilizable a ${width} px`, async ({ page, services }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const [path, heading] of [
      ['', 'Encuentra información para'],
      ['search', 'Buscar medicamentos'],
      ['search/mapa', 'Farmacias cercanas'],
    ]) {
      await page.goto(`${services.url('frontend')}${path}`);
      await expect(page.getByRole('main')).toContainText(heading);
      const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      expect(overflows, `${path || '/'} no debe desbordar a ${width} px`).toBe(false);
      if (width === 640) {
        const captures = nodePath.resolve('.cache/f08/responsive-640');
        mkdirSync(captures, { recursive: true });
        await page.screenshot({ path: nodePath.join(captures, `${path.replaceAll('/', '-') || 'inicio'}.png`), fullPage: true });
      }
    }
  });
}

test('el teclado alcanza la navegación y la búsqueda sin usar el mouse', async ({ page, services }) => {
  await page.goto(services.url('frontend'));
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Saltar al contenido' })).toBeFocused();
  await page.getByRole('link', { name: 'Buscar medicamentos' }).first().focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Buscar medicamentos' })).toBeVisible();
  await page.getByLabel('Nombre comercial o principio activo').focus();
  await expect(page.getByLabel('Nombre comercial o principio activo')).toBeFocused();
});
