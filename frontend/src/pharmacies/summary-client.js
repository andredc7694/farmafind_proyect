/** F08.1: lecturas de resumen (solo lectura). El servidor decide a quién responde; aquí solo se piden las que la capacidad permite. */
function failure(status) { return Object.assign(new Error('No se pudo consultar el resumen'), { status }); }

export function createSummaryClient(fetchImpl = fetch) {
  async function get(url) {
    const response = await fetchImpl(url, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw failure(response.status);
    return response.json();
  }
  const enc = encodeURIComponent;
  return {
    reservations: pharmacyId => get(`/api/v1/farmacias/${enc(pharmacyId)}/reservas/resumen`),
    inventory: pharmacyId => get(`/api/v1/farmacias/${enc(pharmacyId)}/inventario/resumen`),
  };
}
