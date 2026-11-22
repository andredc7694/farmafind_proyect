import { readFileSync } from 'node:fs';
import { test, expect } from './browser-fixture.mjs';
import { healthCheck } from '../../scripts/f00/http-checks.mjs';
test.use({ serviceWorkers: 'block' });

test('la UI y los otros procesos sobreviven a cada parada individual', async ({ page, services }) => {
  await page.goto(services.url('frontend'));
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toBeVisible();
  await services.stop('notifications');
  await services.health('api');
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toBeVisible();
  await services.start('notifications');
  await services.stop('api');
  await services.health('notifications');
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toBeVisible();
  await services.start('api');
  await services.stop('frontend');
  await services.health('api'); await services.health('notifications');
  await services.start('frontend');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toBeVisible();
});

test('un marcador ausente o un recurso de montaje fallido se detecta como fallo esperado', async ({ page, services }) => {
  const blank = readFileSync(new URL('../fixtures/browser/blank.html', import.meta.url), 'utf8');
  await page.route(services.url('frontend'), route => route.fulfill({ status: 200, contentType: 'text/html', body: blank }));
  await page.goto(services.url('frontend'));
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toHaveCount(0);
  await page.unroute(services.url('frontend'));
  await page.route('**/assets/*.js', route => route.abort());
  await page.goto(services.url('frontend'));
  await expect(page.getByRole('heading', { name: 'FarmaFind — Bootstrap' })).toHaveCount(0);
});

test('identidad de endpoint errónea no supera el control', async ({ services }) => {
  await expect(healthCheck(services.url('notifications'), 'farmafind-api')).rejects.toThrow('identidad');
});
