/** Synthetic local document HTTP test. Never uploads a person's real document. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';

const credentials=JSON.parse(readFileSync(new URL('../../.cache/f025-docker/credentials.local.json',
  import.meta.url),'utf8'));
const prior=JSON.parse(readFileSync(new URL('../../.cache/f025-docker/http-activation.local.json',
  import.meta.url),'utf8'));
const base='http://127.0.0.1:3000/api/v1',origin='http://127.0.0.1:5173';
class Browser{
  cookies=new Map();csrf='';
  async call(method,path,body){
    const headers={Origin:origin,Cookie:[...this.cookies.values()].join('; ')};
    if(method!=='GET'&&this.csrf)headers['X-CSRF-Token']=this.csrf;
    if(body!==undefined)headers['Content-Type']='application/json';
    const response=await fetch(base+path,{method,headers,
      body:body===undefined?undefined:JSON.stringify(body)});
    for(const value of response.headers.getSetCookie()){
      const pair=value.split(';')[0];this.cookies.set(pair.split('=')[0],pair);
    }
    const content=await response.text();return {status:response.status,
      body:content?JSON.parse(content):null};
  }
  async renew(){const result=await this.call('GET','/auth/csrf');assert.equal(result.status,200);
    this.csrf=result.body.csrfToken;}
  cookie(){return [...this.cookies.values()].join('; ');}
}
let passed=0;
const suffix=randomBytes(5).toString('hex');
const owner=prior.owner;
const browser=new Browser();await browser.renew();
assert.equal((await browser.call('POST','/auth/login',owner)).status,200);passed++;
await browser.renew();
const input={nombreComercial:`Farmacia Documento TEST ${suffix}`,contacto:'Contacto ficticio',
  direccion:'Calle TEST 1',departamento:'Lima',provincia:'Lima',distrito:'Lima',
  representante:'Representante ficticio'};
const application=await browser.call('POST','/pharmacy-applications',input);
assert.equal(application.status,201);passed++;
const id=application.body.id;
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL4VwAAAABJRU5ErkJggg==','base64');
const form=new FormData();form.append('archivo',new Blob([bytes],{type:'image/png'}),'sintetico.png');
const upload=await fetch(`${base}/pharmacy-applications/${id}/documents`,{method:'POST',
  headers:{Origin:origin,Cookie:browser.cookie(),'X-CSRF-Token':browser.csrf},body:form});
if(upload.status!==201)console.error('F02.5 upload TEST:',upload.status,await upload.text());
assert.equal(upload.status,201);const created=await upload.json();
assert.equal(created.tipo,'image/png');passed++;
const denied=await fetch(`${base}/platform/pharmacy-applications/${id}/documents/${created.id}`,
  {headers:{Origin:origin,Cookie:browser.cookie()}});
assert.equal(denied.status,404);passed++;
const reviewer=new Browser();await reviewer.renew();
assert.equal((await reviewer.call('POST','/auth/login',credentials.reviewer)).status,200);passed++;
const download=await fetch(`${base}/platform/pharmacy-applications/${id}/documents/${created.id}`,
  {headers:{Origin:origin,Cookie:reviewer.cookie()}});
assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'image/png');
assert.deepEqual(Buffer.from(await download.arrayBuffer()),bytes);passed++;
console.log(JSON.stringify({kind:'F025_TEST_DOCUMENT_HTTP',passed,
  syntheticOnly:true,privateDownload:true}));
