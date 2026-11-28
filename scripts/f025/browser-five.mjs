/** Browser-only TEST workflow against the technical F02.5 database. No private values are logged. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {chromium,expect as baseExpect} from '@playwright/test';
const expect=baseExpect.configure({timeout:20000}); // las pantallas cargan listas largas y el equipo puede estar ocupado

assert.equal(process.platform,'linux');
assert.equal(process.env.F025_E2E_CONTAINER,'1');
const local=new URL('../../.cache/f025-docker/',import.meta.url);
const state=JSON.parse(readFileSync(new URL('state.local.json',local),'utf8'));
assert.match(state.database,/^farmafind_f01_test_[a-f0-9]{12}$/);
const credentials=JSON.parse(readFileSync(new URL('credentials.local.json',local),'utf8'));
const browserUsers=JSON.parse(readFileSync(new URL('browser-users.local.json',local),'utf8'));
assert.equal(browserUsers.kind,'F025_BROWSER_ORDINARY_TEST');
assert.equal(browserUsers.database,state.database);
assert.equal(browserUsers.accounts.length,5);
const root='http://127.0.0.1:5173';
const count=Number(process.env.F025_BROWSER_COUNT??'5');
assert(Number.isInteger(count)&&count>=1&&count<=5);
const crossOnly=process.env.F025_BROWSER_CROSS_ONLY==='1';
const importJourney=process.env.F025_BROWSER_IMPORT==='1';
const reserveOnly=process.env.F025_BROWSER_RESERVE_ONLY==='1';
const compareJourney=process.env.F025_BROWSER_COMPARE==='1';
const queueJourney=process.env.F025_BROWSER_QUEUE==='1';
const importVariants=process.env.F025_BROWSER_IMPORT_VARIANTS==='1';
const returnJourney=process.env.F025_BROWSER_RETURN==='1';
const staffJourney=process.env.F025_BROWSER_STAFF==='1'; // F025-FR-029
const browser=await chromium.launch({headless:true});
const owners=[];
let checks=0;
try{
  const reviewerContext=await browser.newContext();
  reviewerContext.setDefaultNavigationTimeout(60000);
  const reviewer=await reviewerContext.newPage();
  await reviewer.goto(`${root}/identity`);
  await reviewer.locator('#login-email').fill(credentials.reviewer.email);
  await reviewer.locator('#login-password').fill(credentials.reviewer.password);
  await reviewer.getByRole('button',{name:'Iniciar sesión'}).click();
  await expect(reviewer.getByRole('heading',{name:'Sesión activa'})).toBeVisible({timeout:15000});checks++;
  for(let number=1;number<=count;number++){
    if(number>1&&process.env.F025_BROWSER_PACE_MS)await new Promise(done=>setTimeout(done,Number(process.env.F025_BROWSER_PACE_MS))); // evita el límite de peticiones por IP de la API
    const marker=randomBytes(5).toString('hex');
    const name=`Farmacia Navegador ${number} ${marker}`;
    const ownerContext=await browser.newContext();
    ownerContext.setDefaultNavigationTimeout(60000);
    const owner=await ownerContext.newPage();
    owner.on('response',r=>{if(r.status()>=400)console.log(JSON.stringify({kind:'HTTP',number,status:r.status(),path:new URL(r.url()).pathname}));});
    owner.on('requestfailed',r=>console.log(JSON.stringify({kind:'REQFAILED',number,path:new URL(r.url()).pathname,why:r.failure()?.errorText})));
    await owner.goto(`${root}/identity`);
    const account=browserUsers.accounts[number-1];
    await owner.locator('#login-email').fill(account.email);
    await owner.locator('#login-password').fill(account.password);
    await owner.getByRole('button',{name:'Iniciar sesión'}).click();
    await expect(owner.getByRole('heading',{name:'Sesión activa'})).toBeVisible({timeout:15000});checks++;
    if(crossOnly){
      const memberships=await ownerContext.request.get(`${root}/api/v1/me/memberships`);
      assert.equal(memberships.status(),200);
      const own=(await memberships.json()).filter(item=>
        item.pharmacyName.startsWith(`Farmacia Navegador ${number} `));
      assert(own.length>=1);
      // Varias ejecuciones dejan varias farmacias por cuenta: se prefiere la última con inventario vacío (para importar sin choques).
      let chosen=own.at(-1);
      for(const item of [...own].reverse()){
        const inventory=await ownerContext.request.get(`${root}/api/v1/farmacias/${item.pharmacyId}/inventario`);
        if(inventory.status()===200&&(await inventory.json()).length===0){chosen=item;break;}
      }
      owners.push({context:ownerContext,id:chosen.pharmacyId,name:chosen.pharmacyName});
      continue;
    }
    await owner.goto(`${root}/farmacias/solicitar`);
    await owner.getByLabel('Nombre comercial').fill(name);
    await owner.getByLabel('Contacto ficticio').fill('Contacto TEST');
    await owner.getByLabel('Dirección ficticia').fill(`Calle TEST ${number}`);
    await owner.getByLabel('Departamento').fill('Lima');
    await owner.getByLabel('Provincia').fill('Lima');
    await owner.getByLabel('Distrito').fill('Lima');
    await owner.getByLabel('Representante ficticio').fill('Representante TEST');
    await owner.getByRole('button',{name:'Guardar borrador'}).click();
    const ownRequest=owner.locator('li').filter({hasText:name});
    await expect(ownRequest).toContainText('BORRADOR');
    await ownRequest.getByRole('button',{name:'Enviar solicitud'}).click();
    await expect(ownRequest).toContainText('PENDIENTE');checks++;
    await reviewer.goto(`${root}/admin/farmacias/solicitudes`);
    await reviewer.getByRole('button',{name:new RegExp(name)}).click();
    await reviewer.getByLabel('Motivo de la decisión').fill('Revision sintetica TEST');
    await reviewer.getByRole('button',{name:'INICIAR REVISION'}).click();
    const inReview=reviewer.getByRole('button',{name:new RegExp(`${name}.*EN_REVISION`)});
    await expect(inReview).toBeVisible();
    await inReview.click();
    await expect(reviewer.getByRole('heading',{name})).toBeVisible();
    await reviewer.getByLabel('Motivo de la decisión').fill('Aprobacion sintetica TEST');
    await reviewer.getByRole('button',{name:'APROBAR'}).click();
    await expect(reviewer.getByRole('alert').filter({hasText:'Decisión registrada'})).toBeVisible();checks++;
    await owner.goto(`${root}/farmacias/panel`);
    const selector=owner.getByRole('button',{name});
    await expect(selector).toBeVisible();
    await selector.click();
    await owner.getByRole('navigation',{name:'Secciones de la farmacia'}).getByRole('button',{name:'Inventario'}).click(); // F08.1: el panel abre en «Resumen»
    await expect(owner.getByRole('heading',{name:'Inventario de la farmacia'})).toBeVisible();
    const memberships=await ownerContext.request.get(`${root}/api/v1/me/memberships`);
    assert.equal(memberships.status(),200);
    const own=await memberships.json();
    const membership=own.find(item=>item.pharmacyName===name);
    assert(membership);
    for(const capability of ['reservation.read','reservation.accept','reservation.deliver','reservation.settings'])
      assert(membership.delegationCodes.includes(capability));
    owners.push({context:ownerContext,id:membership.pharmacyId,name});checks++;
    if(staffJourney){
      // F025-FR-029: el propietario recién activado abre «Personal» y crea un trabajador con clave temporal.
      assert(membership.delegationCodes.includes('membership.manage'));
      await owner.getByRole('navigation',{name:'Secciones de la farmacia'}).getByRole('button',{name:'Personal'}).click();
      await expect(owner.getByRole('heading',{name:'Personal de la farmacia'})).toBeVisible();checks++;
      const alias=`caja.${marker}`;
      await owner.getByLabel('Usuario (alias) del trabajador').fill(alias);
      await owner.getByLabel('Nombre para mostrar').fill('Caja ficticia TEST');
      await owner.getByLabel('Ver inventario').first().check();
      await owner.getByRole('button',{name:'Crear cuenta de trabajador'}).click();
      const temporary=(await owner.getByLabel('Clave temporal').textContent()).trim();
      assert(temporary.length>=12);checks++;
      const workerContext=await browser.newContext();
      const worker=await workerContext.newPage();
      await worker.goto(`${root}/identity`);
      const form=worker.locator('form').filter({has:worker.getByRole('button',{name:'Iniciar sesión'})});
      await form.getByLabel('Usuario o correo electrónico').fill(alias);
      await form.getByLabel('Contraseña').fill(temporary);
      await form.getByRole('button',{name:'Iniciar sesión'}).click();
      await expect(worker.getByRole('heading',{name:'Define tu clave definitiva'})).toBeVisible();checks++;
      const definitive=`Aa1!${randomBytes(12).toString('hex')}`;
      await worker.getByLabel('Clave nueva (mínimo 12 caracteres)').fill(definitive);
      await worker.getByLabel('Repite la clave nueva').fill(definitive);
      await worker.getByRole('button',{name:'Guardar clave y continuar'}).click();
      await expect(worker.getByRole('heading',{name:'Sesión activa'})).toBeVisible();
      const workerMemberships=await (await workerContext.request.get(`${root}/api/v1/me/memberships`)).json();
      const workerOwn=workerMemberships.find(item=>item.pharmacyId===membership.pharmacyId);
      assert(workerOwn&&workerOwn.delegationCodes.includes('inventory.read'));
      assert(!workerOwn.delegationCodes.includes('membership.manage'));checks++;
      const workerStaff=await workerContext.request.get(`${root}/api/v1/pharmacies/${membership.pharmacyId}/staff`);
      assert([403,404].includes(workerStaff.status()));checks++;
      await workerContext.close();
    }
  }
  for(const owner of owners){
    for(const other of owners.filter(item=>item!==owner)){
      const privateInventory=await owner.context.request.get(
        `${root}/api/v1/farmacias/${other.id}/inventario`);
      if(privateInventory.status()!==404){
        const body=privateInventory.status()===429?await privateInventory.json():null;
        console.log(JSON.stringify({kind:'CROSS_INVENTORY_STATUS',status:privateInventory.status(),
          retryAfter:privateInventory.headers()['retry-after']??null,
          code:body?.code??null,message:body?.message??null,
          url:new URL(privateInventory.url()).pathname}));
      }
      assert.equal(privateInventory.status(),404);
      const privateReservations=await owner.context.request.get(
        `${root}/api/v1/farmacias/${other.id}/reservas`);
      if(![403,404].includes(privateReservations.status()))
        console.log(JSON.stringify({kind:'CROSS_RESERVATION_STATUS',status:privateReservations.status(),
          retryAfter:privateReservations.headers()['retry-after']??null}));
      assert([403,404].includes(privateReservations.status()));
      checks+=2;
    }
  }
  if(compareJourney){
    assert(crossOnly,'La comparacion reutiliza las cinco farmacias TEST existentes');
    const catalog=JSON.parse(readFileSync(new URL('catalog-fixture.local.json',local),'utf8'));
    assert.equal(catalog.database,state.database);
    const page=await browser.newPage();
    await page.goto(`${root}/search`);
    await page.locator('#public-query').fill(catalog.name);
    await page.getByRole('button',{name:'Buscar',exact:true}).click();
    await expect(page.locator('.offer').first()).toBeVisible();
    assert((await page.locator('.offer').count())>=5);
    await page.locator('.offer').nth(0).getByRole('checkbox',{name:'Comparar esta oferta'}).check();
    await page.locator('.offer').nth(1).getByRole('checkbox',{name:'Comparar esta oferta'}).check();
    await expect(page.getByRole('heading',{name:'Comparación de ofertas'})).toBeVisible();
    await expect(page.locator('.comparison-panel article')).toHaveCount(2);
    checks+=3;
    await page.locator('#public-query').fill(`sin coincidencia ${randomBytes(8).toString('hex')}`);
    await page.getByRole('button',{name:'Buscar',exact:true}).click();
    await expect(page.getByText('Sin ofertas publicadas')).toBeVisible();checks++;
    await page.close();
  }
  if(queueJourney){
    assert(crossOnly,'La cola reutiliza las cinco farmacias TEST existentes');
    const owner=owners[1];
    const response=await owner.context.request.get(`${root}/api/v1/farmacias/${owner.id}/reservas`);
    assert.equal(response.status(),200);
    assert((await response.json()).some(item=>item.state==='PENDIENTE'));
    const page=await owner.context.newPage();
    await page.goto(`${root}/reservations`);
    await page.getByRole('button',{name:owner.name}).click();
    await expect(page.getByRole('heading',{name:'Cola de la farmacia'})).toBeVisible();
    await expect(page.locator('.reservation-queue').getByText('PENDIENTE')).toBeVisible();
    checks+=3;
    await page.close();
  }
  if(importVariants){
    assert(crossOnly,'Las variantes de importacion reutilizan la farmacia TEST existente');
    const catalog=JSON.parse(readFileSync(new URL('catalog-fixture.local.json',local),'utf8'));
    assert.equal(catalog.database,state.database);
    const owner=owners[0];
    const page=await owner.context.newPage();
    await page.goto(`${root}/farmacias/panel`);
    await page.getByRole('button',{name:owner.name}).click();
    await page.getByRole('navigation',{name:'Secciones de la farmacia'}).getByRole('button',{name:'Importar'}).click(); // F08.1: el panel abre en «Resumen»
    const invalid='nombre,concentracion,presentacion,clasificacion,precio,cantidad\nreferencia inexistente f025,10 mg,tabletas,venta libre,1.00,2\n';
    await page.locator('#inventory-file').setInputFiles({name:'invalido.csv',mimeType:'text/csv',buffer:Buffer.from(invalid)});
    await expect(page.getByText('1 filas; 1 incidencias.')).toBeVisible();
    await expect(page.getByRole('button',{name:'Confirmar archivo completo'})).toBeDisabled();checks+=2;
    const {default:ExcelJS}=await import('@excel.js/exceljs');
    const workbook=new ExcelJS.Workbook();
    workbook.addWorksheet('Inventario').addRows([
      ['nombre','concentracion','presentacion','clasificacion','precio','cantidad'],
      [catalog.name,'10 mg','tabletas','venta libre','2.50','4'],
    ]);
    const xlsx=Buffer.from(await workbook.xlsx.writeBuffer());
    await page.locator('#inventory-file').setInputFiles({name:'inventario-ficticio.xlsx',
      mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:xlsx});
    await expect(page.getByText('1 filas; 0 incidencias.')).toBeVisible();
    await page.getByRole('button',{name:'Confirmar archivo completo'}).click();
    await expect(page.getByRole('row').filter({hasText:catalog.name})).toContainText('4');checks+=2;
    await page.close();
  }
  if(returnJourney){
    assert(crossOnly,'El retorno publico reutiliza las farmacias TEST existentes');
    const catalog=JSON.parse(readFileSync(new URL('catalog-fixture.local.json',local),'utf8'));
    assert.equal(catalog.database,state.database);
    const context=await browser.newContext();
    const page=await context.newPage();
    await page.goto(`${root}/search`);
    await page.locator('#public-query').fill(catalog.name);
    await page.getByRole('button',{name:'Buscar',exact:true}).click();
    const offer=page.locator('.offer').filter({has:page.getByRole('heading',{name:owners[1].name})});
    await offer.getByRole('link',{name:'Solicitar reserva'}).click();
    await expect(page.locator('#login-email')).toBeVisible();
    assert.equal(new URL(page.url()).searchParams.get('pharmacyId'),owners[1].id);
    assert.equal(new URL(page.url()).searchParams.get('medicationId'),catalog.id);
    await page.locator('#login-email').fill(browserUsers.accounts[0].email);
    await page.locator('#login-password').fill(browserUsers.accounts[0].password);
    await page.getByRole('button',{name:'Iniciar sesión'}).click();
    await expect(page.locator('#reservation-medication')).toHaveValue(catalog.id);
    await expect(page.getByRole('button',{name:'Solicitar reserva'})).toBeEnabled();
    checks+=3;
    await context.close();
  }
  if(importJourney||reserveOnly){
    assert(crossOnly,'El recorrido de importación/reserva reutiliza las cinco farmacias TEST existentes');
    const catalog=JSON.parse(readFileSync(new URL('catalog-fixture.local.json',local),'utf8'));
    assert.equal(catalog.database,state.database);
    if(importJourney)for(const [index,owner] of owners.entries()){
      const page=await owner.context.newPage();
      await page.goto(`${root}/farmacias/panel`);
      await page.getByRole('button',{name:owner.name}).click();
      await page.getByRole('navigation',{name:'Secciones de la farmacia'}).getByRole('button',{name:'Importar'}).click(); // F08.1: el panel abre en «Resumen»
      await expect(page.getByRole('heading',{name:'Importar inventario'})).toBeVisible();
      const csv=`nombre,concentracion,presentacion,clasificacion,precio,cantidad\n${catalog.name},10 mg,tabletas,venta libre,${(index+1).toFixed(2)},${index+2}\n`;
      await page.locator('#inventory-file').setInputFiles({name:'inventario-ficticio.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});
      // Enmienda F02.1: la vista previa aparece sola al elegir el archivo.
      await expect(page.getByRole('heading',{name:/Vista previa:/})).toBeVisible();
      await expect(page.getByText('1 filas; 0 incidencias.')).toBeVisible();
      await page.getByRole('button',{name:'Confirmar archivo completo'}).click();
      await expect(page.getByText(/Importación confirmada/)).toBeVisible();
      const ownInventory=await owner.context.request.get(`${root}/api/v1/farmacias/${owner.id}/inventario`);
      assert.equal(ownInventory.status(),200);
      assert((await ownInventory.json()).some(item=>item.medicamentoId===catalog.id));
      checks+=4;
      await page.close();
    }
    if(reserveOnly)for(const owner of owners){
      const ownInventory=await owner.context.request.get(`${root}/api/v1/farmacias/${owner.id}/inventario`);
      assert.equal(ownInventory.status(),200);
      assert((await ownInventory.json()).some(item=>item.medicamentoId===catalog.id));
      checks++;
    }
    const publicPage=await browser.newPage();
    await publicPage.goto(`${root}/search`);
    await publicPage.locator('#public-query').fill(catalog.name);
    await publicPage.getByRole('button',{name:'Buscar',exact:true}).click();
    await expect(publicPage.locator('.offer').first()).toBeVisible();
    assert((await publicPage.locator('.offer').count())>=5);checks++;
    const publicResponse=await publicPage.request.get(`${root}/api/v1/busquedas?q=${encodeURIComponent(catalog.name)}`);
    assert.equal(publicResponse.status(),200);
    const publicResults=await publicResponse.json();
    assert(publicResults.ofertas.length>=5);
    for(const owner of owners)
      assert(publicResults.ofertas.some(offer=>offer.farmacia.id===owner.id));
    assert(publicResults.ofertas.every(offer=>!('cantidadFisica' in offer)&&!('cantidadComprometida' in offer)));
    checks++;
    await publicPage.close();
    const customer=await owners[0].context.newPage();
    await customer.goto(`${root}/search`);
    await customer.locator('#public-query').fill(catalog.name);
    await customer.getByRole('button',{name:'Buscar',exact:true}).click();
    const otherOffer=customer.locator('.offer').filter({has:customer.getByRole('heading',{name:owners[1].name})});
    await otherOffer.getByRole('link',{name:'Solicitar reserva'}).click();
    await expect(customer.locator('#reservation-medication')).toHaveValue(catalog.id);
    await customer.getByRole('button',{name:'Solicitar reserva'}).click();
    await expect(customer.getByText('PENDIENTE')).toBeVisible();checks+=2;
    await customer.close();
  }
  console.log(JSON.stringify({kind:'F025_BROWSER_FIVE',pharmacies:owners.length,checks,
    inventoryImported:importJourney||importVariants,inventoryVerified:reserveOnly,
    reservationCreated:importJourney||reserveOnly,technicalTestDatabaseOnly:true}));
}finally{
  await Promise.all(owners.map(owner=>owner.context.close()));
  await browser.close();
}
