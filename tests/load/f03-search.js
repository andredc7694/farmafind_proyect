import http from 'k6/http';
import { check,sleep } from 'k6';
// 3 VUs with a one-second pause remain below the documented per-process abuse limit (60/min/IP).
export const options={vus:3,duration:'15s',thresholds:{http_req_duration:['p(95)<2000'],http_req_failed:['rate<0.01']}};
const base=__ENV.F03_BASE_URL||'http://host.docker.internal:3000';
export default function(){ const response=http.get(`${base}/api/v1/busquedas?q=paracetamol`);
  check(response,{'status 200':value=>value.status===200,'sin campos privados':value=>!value.body.includes('cantidad_fisica')&&!value.body.includes('cantidad_comprometida')}); sleep(1); }
