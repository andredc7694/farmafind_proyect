function failure(){return new Error('No se pudo completar la operacion de reserva');}
export function createReservationsClient(fetchImpl=fetch){
  async function csrf(){const r=await fetchImpl('/api/v1/auth/csrf',{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw failure();return (await r.json()).csrfToken;}
  async function get(path){const r=await fetchImpl(path,{credentials:'same-origin',cache:'no-store'});if(!r.ok)throw failure();return r.json();}
  async function mutate(path,body,method='POST'){const token=await csrf();const r=await fetchImpl(path,{method,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json','X-CSRF-Token':token,'Idempotency-Key':crypto.randomUUID()},body:body===undefined?undefined:JSON.stringify(body)});if(!r.ok)throw failure();return r.json();}
  return { own:()=>get('/api/v1/reservas'),create:(pharmacyId,medicationId,quantity)=>mutate('/api/v1/reservas',{pharmacyId,medicationId,quantity}),cancel:id=>mutate(`/api/v1/reservas/${id}/cancelar`),
    queue:id=>get(`/api/v1/farmacias/${id}/reservas`),settings:id=>get(`/api/v1/farmacias/${id}/reservas/configuracion`),saveSettings:(id,hours)=>mutate(`/api/v1/farmacias/${id}/reservas/configuracion`,{pickupWindowHours:hours},'PUT'),
    confirm:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/confirmar`),shortage:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/falta-fisica`),deliver:(p,id)=>mutate(`/api/v1/farmacias/${p}/reservas/${id}/entregar`) };
}
