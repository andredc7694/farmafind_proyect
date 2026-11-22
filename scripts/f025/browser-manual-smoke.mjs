/** Read-only browser smoke against the manual slot; never changes applications. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,expect} from '@playwright/test';

assert.equal(process.platform,'linux');
assert.equal(process.env.F025_E2E_CONTAINER,'1');
const browser=await chromium.launch({headless:true});
let checks=0;
try {
  const page=await browser.newPage();
  const root='http://127.0.0.1:5173';
  await page.goto(root);
  await expect(page.getByRole('link',{name:/Buscar medicamentos/}).first()).toBeVisible();checks++;
  await page.goto(`${root}/search`);
  await expect(page.getByRole('heading',{name:'Buscar medicamentos'})).toBeVisible();checks++;
  await page.locator('#public-query').fill('producto demo');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByText('Sin ofertas publicadas')).toBeVisible();checks++;
  await page.goto(`${root}/farmacias/solicitar`);
  await expect(page.getByRole('link',{name:'Ir a mi cuenta'})).toBeVisible();checks++;
  await page.goto(`${root}/identity`);
  await expect(page.locator('#login-email')).toBeVisible();checks++;
  const credentials=JSON.parse(readFileSync(new URL('../../.cache/f025-docker/credentials.manual.local.json',import.meta.url),'utf8'));
  await page.locator('#login-email').fill(credentials.reviewer.email);
  await page.locator('#login-password').fill(credentials.reviewer.password);
  await page.getByRole('button',{name:'Iniciar sesión'}).click();
  await expect(page.getByRole('heading',{name:'Sesión activa'})).toBeVisible();checks++;
  const reviewLink=page.getByRole('navigation',{name:'Navegación principal'})
    .getByRole('link',{name:'Revisar solicitudes'});
  await expect(reviewLink).toBeVisible();checks++;
  await reviewLink.click();
  await expect(page.getByRole('heading',{name:'Solicitudes de farmacias'})).toBeVisible();checks++;
  if(process.env.F025_EXPECT_APPLICATION){
    const request=page.getByRole('button',{name:new RegExp(process.env.F025_EXPECT_APPLICATION)});
    await expect(request).toContainText('PENDIENTE');checks++;
    await request.click();
    await expect(page.getByRole('heading',{name:process.env.F025_EXPECT_APPLICATION})).toBeVisible();checks++;
    await expect(page.getByRole('button',{name:'INICIAR REVISION'})).toBeVisible();checks++;
  }
  console.log(JSON.stringify({kind:'F025_MANUAL_BROWSER_SMOKE',checks,readOnly:true}));
} finally {await browser.close();}
