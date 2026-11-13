import { test,expect } from '@playwright/test';
test.use({baseURL:'http://127.0.0.1:5173',serviceWorkers:'block'});
test.beforeEach(async({page})=>{ await page.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort()); });
test('búsqueda y comparación pública sin sesión',async({page})=>{
  await page.goto('/search'); await page.getByLabel('Nombre comercial o principio activo').fill('paracetamol');
  await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByText('Farmacia Alfa')).toBeVisible(); await expect(page.getByText('Farmacia Beta')).toBeVisible();
  await expect(page.getByText(/Precio y disponibilidad referenciales/)).toBeVisible();
});
test('estado vacío y ubicación no disponible conservan dirección',async({page})=>{
  await page.goto('/search'); await page.getByLabel('Nombre comercial o principio activo').fill('sincoincidencia');
  await page.getByRole('button',{name:'Buscar',exact:true}).click(); await expect(page.getByText(/No encontramos ofertas/)).toBeVisible();
  await page.evaluate(()=>Object.defineProperty(navigator,'geolocation',{value:undefined,configurable:true}));
  await page.getByRole('button',{name:'Usar mi ubicación'}).click(); await expect(page.getByRole('alert')).toContainText('ubicación no está disponible');
});
