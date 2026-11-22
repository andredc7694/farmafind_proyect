/** Public-only F02.5 regression on Linux; no credentials, maps provider, or writes. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {chromium,expect} from '@playwright/test';

assert.equal(process.platform,'linux');
assert.equal(process.env.F025_E2E_CONTAINER,'1');
const root='http://127.0.0.1:5173';
const browser=await chromium.launch({headless:true});
let checks=0;
const external=[];
try{
  const page=await browser.newPage();
  page.on('request',request=>{
    const url=new URL(request.url());
    if(['http:','https:'].includes(url.protocol)&&url.hostname!=='127.0.0.1') external.push(url.hostname);
  });
  await page.goto(`${root}/search`,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Buscar medicamentos'})).toBeVisible();checks++;
  await page.locator('#public-query').fill(`sin coincidencia ${randomBytes(8).toString('hex')}`);
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByText('Sin ofertas publicadas')).toBeVisible();checks++;
  const search=await page.request.get(`${root}/api/v1/busquedas?q=producto`);
  assert.equal(search.status(),200);
  const offers=(await search.json()).ofertas;
  assert(Array.isArray(offers));
  assert(offers.every(offer=>!('cantidadFisica' in offer)&&!('cantidadComprometida' in offer)));
  checks++;

  await page.goto(`${root}/mapa`,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Farmacias cercanas'})).toBeVisible();checks++;
  await page.locator('#geo-city').fill('Lima');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.locator('section[aria-live="polite"]')).toBeVisible();checks++;
  assert.equal(external.length,0,'La consulta geográfica cargó un proveedor externo sin consentimiento');checks++;

  await page.goto(`${root}/assistant/conversation`,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('heading',{name:'Asistente conversacional informativo'})).toBeVisible();checks++;
  await page.locator('#conversation-query').fill('¿Qué dosis debo tomar?');
  await page.getByRole('button',{name:'Consultar'}).click();
  await expect(page.getByText(/No puedo diagnosticar ni elegir tratamientos/)).toBeVisible();
  assert.equal(await page.locator('.conversation-answer').count(),1);checks++;
  assert.equal(external.length,0,'El recorrido público utilizó un proveedor externo');checks++;
  console.log(JSON.stringify({kind:'F025_PUBLIC_BROWSER',checks,publicOffers:offers.length,
    clinicalRejected:true,externalProviders:0,credentialsUsed:false}));
}finally{await browser.close();}
