import { test, expect } from '../../tests/bootstrap/browser-fixture.mjs';
test.use({ serviceWorkers: 'block' });

test('pantalla técnica React de F00', async ({ page, services }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => errors.push(`recurso fallido: ${request.url()}`));
  page.on('response', response => { if (response.status() >= 400) errors.push(`HTTP ${response.status()}`); });
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname)) return route.abort();
    return route.continue();
  });
  const response = await page.goto(services.url('frontend'));
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap', exact: true })).toBeVisible();
  await expect(page.getByText('Modo técnico: sin funcionalidades de negocio', { exact: true })).toBeVisible();
  expect(await page.locator('#root').innerHTML()).not.toBe('');
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('bootstrap.png') });
});
