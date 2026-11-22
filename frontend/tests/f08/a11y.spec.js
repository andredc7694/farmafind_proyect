import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '../../../tests/bootstrap/browser-fixture.mjs';

test('Inicio cumple los controles automáticos graves WCAG 2.2 AA', async ({ page, services }) => {
  await page.goto(services.url('frontend'));
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations.filter(item => item.impact === 'critical' || item.impact === 'serious'))
    .toEqual([]);
});

test('Búsqueda pública mantiene etiquetas y foco accesibles sin sesión', async ({ page, services }) => {
  await page.route('**/api/v1/auth/session', route => route.fulfill({ status: 401, body: '{}' }));
  await page.goto(`${services.url('frontend')}search`);
  await expect(page.getByLabel('Nombre comercial o principio activo')).toBeVisible();
  const result = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(result.violations.filter(item => item.impact === 'critical' || item.impact === 'serious'))
    .toEqual([]);
});
