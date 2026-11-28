// Genera tests/postman/farmafind-sprint2.postman_collection.json (formato Postman v2.1) y su entorno.
// Se versiona el JSON generado; este archivo es la fuente legible. Sin secretos: credenciales y URL llegan al ejecutar.
import { writeFileSync } from 'node:fs';

const json = { key: 'Content-Type', value: 'application/json' };
const origin = { key: 'Origin', value: '{{origin}}' };
const csrf = { key: 'X-CSRF-Token', value: '{{csrfToken}}' };
const url = raw => `{{baseUrl}}${raw}`;
const script = (listen, exec) => ({ listen, script: { type: 'text/javascript', exec } });
const item = (name, method, path, tests, { headers = [], body, pre } = {}) => ({
  name,
  event: [script('test', tests), ...(pre ? [script('prerequest', pre)] : [])],
  request: { method, header: headers, url: url(path), ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body) } } : {}) },
});
const status = code => `pm.test("responde ${code}", () => pm.response.to.have.status(${code}));`;
const oneOf = (codes, label) => `pm.test("${label} (${codes.join(' o ')})", () => pm.expect([${codes.join(',')}]).to.include(pm.response.code));`;
const noPrivate = 'pm.test("no expone datos privados (stock exacto, costo, reservas)", () => { const t = pm.response.text(); ["cantidadFisica","cantidad_fisica","cantidadComprometida","precioCompra","reservas"].forEach(k => pm.expect(t).to.not.include(k)); });';
const safeError = 'pm.test("error sin SQL ni secretos", () => pm.expect(pm.response.text()).to.not.match(/select |password_hash|stack/i));';
const time = ms => `pm.test("tiempo < ${ms} ms", () => pm.expect(pm.response.responseTime).to.be.below(${ms}));`;
const saveCsrf = 'pm.collectionVariables.set("csrfToken", pm.response.json().csrfToken);';
const BURST = 'Búsqueda repetida hasta el 429';

const collection = {
  info: {
    name: 'FarmaFind Sprint 2 — API REST (copia TEST)',
    description: 'Pruebas funcionales y de seguridad de la API pública y de farmacia. Ejecutar solo contra la copia temporal (3001), nunca contra la DEMO.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [
    { name: '1. Públicos', item: [
      item('Salud del servicio', 'GET', '/health', [status(200), time(500)]),
      item('Búsqueda de medicamento', 'GET', '/api/v1/busquedas?q=paracetamol', [status(200), time(2000), noPrivate,
        'pm.test("devuelve ofertas con farmacia y precio", () => { const b = pm.response.json(); pm.expect(b.ofertas).to.be.an("array").that.is.not.empty; pm.expect(b.ofertas[0].farmacia.id).to.be.a("string"); });',
        'pm.collectionVariables.set("publicPharmacyIds", JSON.stringify([...new Set(pm.response.json().ofertas.map(o => o.farmacia.id))]));']),
      item('Búsqueda inválida (1 letra)', 'GET', '/api/v1/busquedas?q=a', [status(400), safeError]),
      item('Parámetro desconocido se ignora sin exponer stock', 'GET', '/api/v1/busquedas?q=paracetamol&stock=1', [status(200), noPrivate]),
      item('Sugerencias', 'GET', '/api/v1/busquedas/sugerencias?q=ibupro', [status(200), time(2000)]),
      item('Farmacias por ciudad', 'GET', '/api/v1/geolocalizacion/farmacias?ciudad=ayacucho', [status(200), time(2000), noPrivate]),
      item('Farmacias cercanas (ubicación en el cuerpo)', 'POST', '/api/v1/geolocalizacion/consultas', [status(200), time(2000), noPrivate],
        { headers: [json], body: { latitud: -13.16, longitud: -74.22, radioKm: 5, q: 'ibuprofeno' } }),
      item('Ubicación en la URL se rechaza', 'POST', '/api/v1/geolocalizacion/consultas?latitud=-13.16', [status(400)],
        { headers: [json], body: { latitud: -13.16, longitud: -74.22, radioKm: 5 } }),
      item('Asistente: pregunta por un medicamento', 'POST', '/api/v1/asistente/conversaciones', [status(200), time(3000), noPrivate],
        { headers: [json, origin], body: { consulta: '¿Dónde hay ibuprofeno 400 mg?' } }),
      item('Asistente: campos no permitidos se rechazan', 'POST', '/api/v1/asistente/conversaciones', [status(400), safeError],
        { headers: [json, origin], body: { consulta: 'hola', usuarioId: 'x' } }),
    ] },
    { name: '2. Seguridad sin sesión', item: [
      item('Mis reservas sin sesión', 'GET', '/api/v1/reservas', [status(401), safeError]),
      item('Mis membresías sin sesión', 'GET', '/api/v1/me/memberships', [status(401)]),
      item('Inventario de una farmacia sin sesión', 'GET', '/api/v1/farmacias/{{otherPharmacyId}}/inventario', [status(401)],
        { pre: ['pm.collectionVariables.set("otherPharmacyId", JSON.parse(pm.collectionVariables.get("publicPharmacyIds"))[0]);'] }),
      item('Crear reserva sin sesión ni CSRF', 'POST', '/api/v1/reservas', [oneOf([401, 403], 'rechazada')],
        { headers: [json, origin], body: { pharmacyId: '00000000-0000-4000-8000-000000000000', medicationId: '00000000-0000-4000-8000-000000000000', quantity: 1 } }),
    ] },
    { name: '3. Sesión de farmacia y aislamiento', item: [
      item('Token CSRF', 'GET', '/api/v1/auth/csrf', [status(200), saveCsrf]),
      item('Login con contraseña incorrecta', 'POST', '/api/v1/auth/login', [status(401),
        'pm.test("mensaje genérico que no repite el correo", () => pm.expect(pm.response.text()).to.not.include(pm.environment.get("ownerEmail")));'],
        { headers: [json, origin, csrf], body: { email: '{{ownerEmail}}', password: 'incorrecta-123456' } }),
      item('Token CSRF (de nuevo)', 'GET', '/api/v1/auth/csrf', [status(200), saveCsrf]),
      item('Login del dueño (copia)', 'POST', '/api/v1/auth/login', [status(200), time(3000)],
        { headers: [json, origin, csrf], body: { email: '{{ownerEmail}}', password: '{{ownerPassword}}' } }),
      item('Mis membresías', 'GET', '/api/v1/me/memberships', [status(200),
        'pm.test("una sola farmacia propia", () => pm.expect(pm.response.json()).to.have.lengthOf(1));',
        'const own = pm.response.json()[0].pharmacyId; pm.collectionVariables.set("pharmacyId", own);',
        'const others = JSON.parse(pm.collectionVariables.get("publicPharmacyIds")).filter(id => id !== own); pm.test("hay otra farmacia para probar aislamiento", () => pm.expect(others).to.not.be.empty); pm.collectionVariables.set("otherPharmacyId", others[0]);']),
      item('Token CSRF de la sesión', 'GET', '/api/v1/auth/csrf', [status(200), saveCsrf]),
      item('Elegir farmacia activa', 'PUT', '/api/v1/me/active-pharmacy', [status(200)],
        { headers: [json, origin, csrf], body: { pharmacyId: '{{pharmacyId}}' } }),
      item('Resumen de inventario propio', 'GET', '/api/v1/farmacias/{{pharmacyId}}/inventario/resumen', [status(200)]),
      item('Inventario de OTRA farmacia (aislamiento RLS)', 'GET', '/api/v1/farmacias/{{otherPharmacyId}}/inventario',
        [status(404), 'pm.test("no revela datos de la otra farmacia", () => pm.expect(pm.response.text()).to.not.include("Botica"));']),
      item('Reservas de OTRA farmacia', 'GET', '/api/v1/farmacias/{{otherPharmacyId}}/reservas', [oneOf([403, 404], 'rechazada')]),
      item('Cambio sin token CSRF', 'PUT', '/api/v1/farmacias/{{pharmacyId}}/reservas/configuracion', [status(403)],
        { headers: [json, origin], body: { pickupWindowHours: 4 } }),
      item('Cerrar sesión', 'POST', '/api/v1/auth/logout', [oneOf([200, 204], 'sesión cerrada')], { headers: [json, origin, csrf] }),
      item('Membresías tras cerrar sesión', 'GET', '/api/v1/me/memberships', [status(401)]),
    ] },
    { name: '4. Protección contra abuso (límite real 60/min por IP)', item: [
      item(BURST, 'GET', '/api/v1/busquedas?q=ibuprofeno', [
        'const n = Number(pm.collectionVariables.get("burst") || 0) + 1; pm.collectionVariables.set("burst", n);',
        `if (pm.response.code === 200 && n < 80) { pm.execution.setNextRequest("${BURST}"); }`,
        'else { pm.test("llega al límite: 429 con Retry-After (intento " + n + ")", () => { pm.response.to.have.status(429); pm.expect(pm.response.headers.get("Retry-After")).to.be.ok; }); }',
      ]),
    ] },
  ],
  variable: ['csrfToken', 'pharmacyId', 'otherPharmacyId', 'publicPharmacyIds', 'burst'].map(key => ({ key, value: key === 'publicPharmacyIds' ? '[]' : '' })),
};
writeFileSync(new URL('../../tests/postman/farmafind-sprint2.postman_collection.json', import.meta.url), JSON.stringify(collection, null, 2) + '\n');
writeFileSync(new URL('../../tests/postman/copia-local.postman_environment.json', import.meta.url), JSON.stringify({
  name: 'FarmaFind copia temporal (3001)', values: [
    { key: 'baseUrl', value: 'http://127.0.0.1:3001', enabled: true },
    { key: 'origin', value: 'http://localhost:5174', enabled: true },
    { key: 'ownerEmail', value: '', enabled: true },
    { key: 'ownerPassword', value: '', type: 'secret', enabled: true },
  ] }, null, 2) + '\n');
console.log('Colección y entorno de Postman generados en tests/postman/');
