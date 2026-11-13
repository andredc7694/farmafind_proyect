/** Public integrated smoke against isolated TEST data. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import request from 'supertest';
import { createLocalIdentityApp } from '../../backend/dist/identity-app.js';
import { validateLocalIdentityRuntime } from '../../backend/dist/config/identity-runtime.js';
import { loadSearchConfig } from '../../backend/dist/config/search.js';

const state=JSON.parse(readFileSync(new URL('../../.cache/f03-fixture/state.local.json',import.meta.url),'utf8'));
assert.equal(state.kind,'F03_TEST_ONLY'); const origin='http://127.0.0.1:5173';
const identity=validateLocalIdentityRuntime({ APP_MODE:'identity',HOST:'127.0.0.1',PORT:'3000',F01_AUTH_DATABASE_URL:state.authUrl,
  F01_DATABASE_URL:state.runtimeUrl,F01_CSRF_KEY_HEX:state.csrfKey,F01_ABUSE_KEY_HEX:state.abuseKey,F01_ALLOWED_ORIGIN:origin,
  F01_CSRF_TRUSTED_ORIGIN:origin,F01_COOKIE_SECURE:'false',F01_ALLOW_HTTP_LOOPBACK:'true' });
const search=loadSearchConfig({SEARCH_REDIS_URL:state.redisUrl});
const composed=await createLocalIdentityApp({...identity,search},url=>new Pool({connectionString:url,max:4}));
try {
  const first=await request(composed.app).get('/api/v1/busquedas?q=paracetamol').expect(200);
  assert.equal(first.body.ofertas.length,2); assert(first.body.ofertas.every(item=>item.disponibilidadReferencial==='DISPONIBLE'));
  assert(!JSON.stringify(first.body).includes('cantidadFisica')); assert(!JSON.stringify(first.body).includes('cantidadComprometida'));
  const second=await request(composed.app).get('/api/v1/busquedas?q=paracetamol&orden=precio_asc').expect(200);
  assert(second.body.ofertas[0].precioReferencialCentavos<=second.body.ofertas[1].precioReferencialCentavos);
  await request(composed.app).get(`/api/v1/farmacias/${state.pharmacies.alfa}`).expect(200);
  await request(composed.app).get('/api/v1/busquedas?q=sincoincidencia').expect(200,{ consulta:'sincoincidencia',ofertas:[],
    paginacion:{pagina:1,tamano:20,total:0,totalPaginas:0},aviso:'Precio y disponibilidad referenciales; confirma existencias con la farmacia.' });
  console.log('F03 smoke: búsqueda, comparación, vacío y perfil público verificados.');
} finally { await composed.close(); }
