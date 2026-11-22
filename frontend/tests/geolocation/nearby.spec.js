import { test, expect } from '@playwright/test';

test.use({baseURL:'http://127.0.0.1:5173',serviceWorkers:'block'});
test.beforeEach(async({page})=>{
  await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)
    ? route.continue() : route.abort());
});

test('ciudad sin permiso: lista pública y estado vacío, sin ubicación almacenada',async({page})=>{
  await page.goto('/mapa');
  await expect(page.getByRole('heading',{name:'Farmacias cercanas'})).toBeVisible();
  await page.getByLabel('Ciudad').fill('Lima');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByText('Farmacia Alfa Centro')).toBeVisible();
  await expect(page.getByText(/Oferta pública referencial: S\/ 12.00/)).toBeVisible();
  expect(page.url()).not.toContain('latitud');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
  expect(await page.context().cookies()).toEqual([]);
  await page.getByLabel('Ciudad').fill('Trujillo');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.getByText('No hay farmacias públicas para esta consulta.')).toBeVisible();
});

test('ubicación manual viaja solo en POST y muestra distancia lineal',async({page})=>{
  const requests=[];
  page.on('request',request=>{if(request.url().includes('/api/v1/geolocalizacion/')) requests.push(request);});
  await page.goto('/mapa');
  await page.getByLabel('Latitud manual (opcional)').fill('-12.0464');
  await page.getByLabel('Longitud manual (opcional)').fill('-77.0428');
  await page.getByLabel('Radio (km)').fill('2');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(3);
  await expect(page.getByText(/Distancia lineal estimada/).first()).toBeVisible();
  expect(requests).toHaveLength(1);
  expect(requests[0].method()).toBe('POST');
  expect(requests[0].url()).not.toMatch(/-12|latitud|longitud/);
  expect(JSON.parse(requests[0].postData())).toMatchObject({latitud:-12.0464,longitud:-77.0428,radioKm:2});
  expect(page.url()).not.toContain('-12');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});

test('permiso denegado conserva ciudad manual y teclado en móvil',async({page})=>{
  await page.setViewportSize({width:375,height:667});
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(_ok,error){error({code:1,message:'denied'});}}});
  });
  await page.goto('/mapa');
  await page.getByRole('button',{name:'Usar mi ubicación una vez'}).click();
  await expect(page.getByRole('alert')).toContainText('Puedes buscar por ciudad');
  await page.getByLabel('Ciudad').focus();
  await page.keyboard.type('Lima');
  await page.getByRole('button',{name:'Buscar farmacias'}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('listitem')).toHaveCount(4);
});

test('permiso concedido es puntual y revocable, sin historial local',async({page})=>{
  const requests=[];
  page.on('request',request=>{if(request.url().includes('/api/v1/geolocalizacion/'))requests.push(request);});
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,'geolocation',{value:{getCurrentPosition(success){
      success({coords:{latitude:-12.0464,longitude:-77.0428}});
    }}});
  });
  await page.goto('/mapa');
  await page.getByRole('button',{name:'Usar mi ubicación una vez'}).click();
  await expect(page.getByRole('alert')).toContainText('Ubicación temporal disponible');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  expect(requests.at(-1).method()).toBe('POST');
  await page.getByRole('button',{name:'Borrar mi ubicación'}).click();
  await expect(page.getByRole('alert')).toContainText('Ubicación temporal borrada');
  await page.getByLabel('Ciudad').fill('Lima');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  expect(requests.at(-1).method()).toBe('GET');
  expect(page.url()).not.toContain('-12');
  expect(await page.evaluate(()=>localStorage.length)).toBe(0);
});

test('mapa solo se intenta cargar tras consentimiento y conserva lista si fallan teselas',async({page})=>{
  const external=[];
  page.on('request',request=>{
    if (!['127.0.0.1','localhost'].includes(new URL(request.url()).hostname)) external.push(request.url());
  });
  await page.goto('/mapa');
  await page.getByLabel('Ciudad').fill('Lima');
  await page.getByRole('button',{name:'Buscar farmacias'}).click();
  await expect(page.getByRole('listitem')).toHaveCount(4);
  expect(external).toEqual([]);
  await page.getByRole('button',{name:'Cargar mapa de OpenStreetMap'}).click();
  await expect(page.getByRole('img',{name:'Mapa interactivo de farmacias públicas verificadas'})).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('la lista y las direcciones siguen visibles');
  await expect(page.getByRole('listitem')).toHaveCount(4);
  await expect(page.getByRole('link',{name:'© OpenStreetMap contributors'}).last()).toBeVisible();
  expect(external.every(url=>url.startsWith('https://tile.openstreetmap.org/'))).toBe(true);
});
