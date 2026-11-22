import{performance}from'node:perf_hooks';
const {QueryAssistant}=await import(new URL('../../backend/dist/modules/asistente-ia/application/query-assistant.js',import.meta.url));
const provider={classify:async()=>({intent:'BUSQUEDA',term:'demo'})};
const result={consulta:'demo',ofertas:[],paginacion:{pagina:1,tamano:20,total:0,totalPaginas:0},aviso:'Precio y disponibilidad referenciales; confirma existencias con la farmacia.'};
const tools={search:async()=>result,compare:async()=>result,pharmacy:async()=>null};const service=new QueryAssistant(provider,tools);
const durations=await Promise.all(Array.from({length:100},async(_,i)=>{const start=performance.now();await service.execute(`demo ${i}`);return performance.now()-start;}));
durations.sort((a,b)=>a-b);const p=n=>durations[Math.ceil(n*durations.length)-1];
console.log(JSON.stringify({requests:durations.length,p95Ms:Number(p(.95).toFixed(3)),p99Ms:Number(p(.99).toFixed(3)),networkProviders:0}));
