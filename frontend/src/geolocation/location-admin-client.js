const path = pharmacyId => `/api/v1/farmacias/${encodeURIComponent(pharmacyId)}/ubicacion/propuestas`;

export function createLocationAdminClient(fetchImpl = fetch) {
  async function mutate(url,body) {
    const csrf=await fetchImpl('/api/v1/auth/csrf',{credentials:'same-origin',cache:'no-store'});
    if(!csrf.ok)throw new Error('No se pudo verificar la sesión');
    const token=(await csrf.json()).csrfToken;
    if(typeof token!=='string')throw new Error('No se pudo verificar la sesión');
    const response=await fetchImpl(url,{method:'POST',credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','X-CSRF-Token':token},body:JSON.stringify(body)});
    if(!response.ok)throw new Error(response.status===409?'La propuesta cambió; actualiza la vista e inténtalo de nuevo':
      response.status===403?'No tienes permiso para esta operación':'No se pudo completar la operación');
    return response.json();
  }
  return {
    propose:(pharmacyId,body)=>mutate(path(pharmacyId),body),
    review:(pharmacyId,proposalId,body)=>mutate(`${path(pharmacyId)}/${encodeURIComponent(proposalId)}/revision`,body),
  };
}
