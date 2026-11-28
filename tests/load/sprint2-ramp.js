// Sprint 2 IS-488 · AC01 / K6-01 / K6-02: búsqueda pública con carga progresiva hasta 2000 usuarios virtuales.
// Solo contra la copia temporal (3001): nunca la DEMO. Lo lanza scripts/load/sprint2.mjs.
//   MODE=ramp  → 50 → 250 → 500 → 1000 → 2000 VU (cada VU: una búsqueda y 1 s de pausa, como una persona).
//   MODE=limit → 20 VU sin pausa durante 20 s contra el límite real (60/min por IP): debe aparecer 429.
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

const MODE = __ENV.MODE || 'ramp';
const BASE = __ENV.BASE_URL || 'http://host.docker.internal:3001';
if (/:(3000|5173)\b/.test(BASE)) throw new Error('k6 detenido: nunca contra la DEMO');

const LEVELS = [50, 250, 500, 1000, 2000];
const RAMP_S = 30;
const HOLD_S = 45;
const stages = LEVELS.flatMap(target => [{ duration: `${RAMP_S}s`, target }, { duration: `${HOLD_S}s`, target }])
  .concat([{ duration: '15s', target: 0 }]);
const thresholds = { http_req_failed: ['rate<0.01'], 'http_req_duration{expected_response:true}': ['p(95)<2000'] };
for (const level of LEVELS) {
  thresholds[`http_req_duration{etapa:${level}}`] = ['p(95)<2000'];
  thresholds[`http_req_failed{etapa:${level}}`] = ['rate<0.01'];
  thresholds[`http_reqs{etapa:${level}}`] = ['count>=0'];
}

export const options = MODE === 'limit'
  ? { vus: 20, duration: '20s', thresholds: { 'checks{tipo:limite}': ['rate>0'] }, summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'] }
  : { stages, thresholds, summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'], discardResponseBodies: false };

const TERMS = ['paracetamol', 'ibuprofeno', 'amoxicilina', 'naproxeno', 'diclofenaco', 'loratadina', 'cetirizina', 'omeprazol',
  'metformina', 'losartan', 'enalapril', 'atorvastatina', 'azitromicina', 'ciprofloxacino', 'fluconazol', 'salbutamol',
  'prednisona', 'ketorolaco', 'metamizol', 'ambroxol', 'vitamina c', 'complejo b', 'tramadol', 'cefalexina', 'metronidazol',
  'paracetamol 500 mg', 'ibuprofeno 400 mg', 'amoxicilina 500 mg', 'omeprazol 200 mg', 'loratadina 10 mg', 'panadol',
  'paracetamol jarabe', 'diclofenaco gel', 'xyzol'];

const status429 = new Counter('respuestas_429');

// Etapa según el tiempo transcurrido: subida + meseta de cada nivel.
function stageOf(elapsedS) {
  const block = RAMP_S + HOLD_S;
  const index = Math.min(LEVELS.length - 1, Math.floor(elapsedS / block));
  return String(LEVELS[index]);
}

export function setup() { return { start: Date.now() }; }

export default function (data) {
  const term = TERMS[Math.floor(Math.random() * TERMS.length)];
  const url = `${BASE}/api/v1/busquedas?q=${encodeURIComponent(term)}`;
  if (MODE === 'limit') {
    const response = http.get(url, { tags: { tipo: 'limite' }, responseCallback: http.expectedStatuses(200, 429) });
    if (response.status === 429) status429.add(1);
    check(response, { 'límite real devuelve 429 con Retry-After': r => r.status !== 429 || Boolean(r.headers['Retry-After']) }, { tipo: 'limite' });
    check(response, { 'solo 200 o 429': r => r.status === 200 || r.status === 429 });
    return;
  }
  const etapa = stageOf((Date.now() - data.start) / 1000);
  const response = http.get(url, { tags: { etapa } });
  if (response.status === 429) status429.add(1);
  check(response, {
    'status 200': r => r.status === 200,
    'sin campos privados': r => typeof r.body === 'string' && !r.body.includes('cantidad_fisica') && !r.body.includes('cantidad_comprometida'),
  });
  sleep(1);
}

export function handleSummary(data) {
  return { '/out/summary.json': JSON.stringify(data, null, 1), stdout: '\n(resumen JSON guardado)\n' };
}
