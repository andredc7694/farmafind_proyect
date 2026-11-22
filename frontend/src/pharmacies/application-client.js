function errorFor(response) {
  if (response.status === 401) return new Error('La sesión terminó. Inicia sesión de nuevo.');
  if (response.status === 403) return new Error('No tienes permiso para esta operación.');
  if (response.status === 404) return new Error('La solicitud no está disponible para esta cuenta.');
  if (response.status === 409) return new Error('La solicitud cambió o está duplicada. Actualiza la lista.');
  return new Error('No se pudo completar la solicitud.');
}
export function createPharmacyApplicationClient(fetchImpl=fetch){
  async function get(path){
    const response=await fetchImpl(`/api/v1${path}`,{credentials:'same-origin',cache:'no-store'});
    if(!response.ok)throw errorFor(response);
    return response.json();
  }
  async function mutate(path,body,key,method='POST'){
    const csrf=await get('/auth/csrf');
    const response=await fetchImpl(`/api/v1${path}`,{
      method,credentials:'same-origin',cache:'no-store',
      headers:{'Content-Type':'application/json','X-CSRF-Token':csrf.csrfToken,
        ...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify(body),
    });
    if(!response.ok)throw errorFor(response);
    return response.json();
  }
  return {
    own:()=>get('/pharmacy-applications/me'),
    one:id=>get(`/pharmacy-applications/${encodeURIComponent(id)}`),
    create:input=>mutate('/pharmacy-applications',input),
    edit:(id,version,input)=>mutate(`/pharmacy-applications/${encodeURIComponent(id)}`,
      {version,...input},null,'PATCH'),
    submit:(id,version)=>mutate(`/pharmacy-applications/${encodeURIComponent(id)}/submit`,
      {version},crypto.randomUUID()+crypto.randomUUID()),
    cancel:(id,version)=>mutate(`/pharmacy-applications/${encodeURIComponent(id)}/cancel`,{version}),
    listForReview:()=>get('/platform/pharmacy-applications?limit=100'),
    canReview:()=>get('/platform/pharmacy-applications?limit=1'),
    detailForReview:id=>get(`/platform/pharmacy-applications/${encodeURIComponent(id)}`),
    decide:(id,accion,version,motivo)=>mutate(
      `/platform/pharmacy-applications/${encodeURIComponent(id)}/decisions`,
      {accion,version,motivo},crypto.randomUUID()+crypto.randomUUID()),
    profile:id=>get(`/farmacias/${encodeURIComponent(id)}/perfil`),
    updateProfile:(id,contacto,version)=>mutate(`/farmacias/${encodeURIComponent(id)}/perfil`,
      {contacto,version},null,'PATCH'),
  };
}
