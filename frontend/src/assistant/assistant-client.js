function errorFor(status) {
  if (status===429) return new Error('Has realizado demasiadas consultas. Inténtalo nuevamente en un momento.');
  if (status===400 || status===413 || status===422) return new Error('Revisa la consulta antes de enviarla.');
  return new Error('El asistente no está disponible temporalmente.');
}
export function createAssistantClient(fetchImpl=fetch) {
  return { query: async consulta => {
    const response=await fetchImpl('/api/v1/asistente/consultar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consulta})});
    if (!response.ok) throw errorFor(response.status);
    return response.json();
  } };
}
