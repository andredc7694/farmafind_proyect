function query(values){const entries=Object.entries(values).filter(([,v])=>v!==undefined&&v!==null&&v!=='');return entries.length?`?${new URLSearchParams(entries.map(([k,v])=>[k,String(v)])).toString()}`:'';}
function failure(){return new Error('No se pudo completar la operacion de reserva');}
export function createReservationsClient(fetchImpl=fetch){
  async function csrf(){const r=await fetchImpl('/api/v1/auth/csrf',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw failure();return (await r.json()).csrfToken;}
  async function get(path){const r=await fetchImpl(path,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw failure();return r.json();}
  async function mutate(path,body,method='POST'){const token=await csrf();const r=await fetchImpl(path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':token,'Idempotency-Key':crypto.randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw failure();return r.json();}
  return { own:()=>get('/api/v1/reservas'),create:(pharmacyId,medicationId,quantity,pickupPreference)=>mutate('/api/v1/reservas',{pharmacyId,medicationId,quantity,...(pickupPreference?{pickupPreference}:{})}),cancel:id=>mutate(`/api/v1/reservas/${id}/cancelar`),
    queue:id=>get(`/api/v1/farmacias/${id}/reservas`),
    /* F04.1: instantánea de atención, historial paginado y exportación CSV (solo lectura). */
    center:(id,filters={})=>get(`/api/v1/farmacias/${id}/reservas/centro${query(filters)}`),
    history:(id,params={})=>get(`/api/v1/farmacias/${id}/reservas/historial${query(params)}`),
    async exportHistory(id,filters={}){const r=await fetchImpl(`/api/v1/farmacias/${id}/reservas/historial/exportar${query(filters)}`,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw failure();return {text:await r.text(),truncated:r.headers.get('X-Export-Truncated')==='true'};},settings:id=>get(`/api/v1/farmacias/${id}/reservas/configuracion`),saveSettings:(id,hours)=>mutate(`/api/v1/farmacias/${id}/reservas/configuracion`,{pickupWindowHours:hours},'PUT'),
    confirm:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/confirmar`),shortage:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/falta-fisica`),deliver:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/entregar`) };
}
