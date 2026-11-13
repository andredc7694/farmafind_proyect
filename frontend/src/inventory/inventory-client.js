function failure(response) {
  if (response.status === 401) return new Error('La sesión terminó. Inicia sesión de nuevo.');
  if (response.status === 403) return new Error('La solicitud no pudo verificarse. Inténtalo de nuevo.');
  if (response.status === 404) return new Error('No tienes acceso a esta farmacia o recurso.');
  if (response.status === 409) return new Error('Los datos cambiaron o el archivo no puede confirmarse. Actualiza la información.');
  return new Error('No se pudo completar la solicitud.');
}

export function createInventoryClient(fetchImpl = fetch) {
  async function get(path) {
    const response = await fetchImpl(`/api/v1${path}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw failure(response);
    return response.json();
  }

  async function csrf() {
    const response = await fetchImpl('/api/v1/auth/csrf', { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw failure(response);
    const data = await response.json();
    if (typeof data.csrfToken !== 'string') throw new Error('No se pudo verificar la solicitud.');
    return data.csrfToken;
  }

  async function change(path, method, body, json = true) {
    const token = await csrf();
    const response = await fetchImpl(`/api/v1${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-CSRF-Token': token, ...(json ? { 'Content-Type': 'application/json' } : {}) },
      body: json ? JSON.stringify(body) : body,
    });
    if (!response.ok) throw failure(response);
    return response.json();
  }

  const path = pharmacyId => `/farmacias/${encodeURIComponent(pharmacyId)}`;
  return {
    catalog: (query = '', page = 1) => get(`/catalogo/medicamentos?q=${encodeURIComponent(query)}&page=${page}`),
    inventory: pharmacyId => get(`${path(pharmacyId)}/inventario`),
    movements: pharmacyId => get(`${path(pharmacyId)}/inventario/movimientos`),
    review: (pharmacyId, medicationId, body) =>
      change(`${path(pharmacyId)}/inventario/${encodeURIComponent(medicationId)}`, 'PUT', body),
    preview: (pharmacyId, file, mapping) => {
      const form = new FormData();
      form.append('archivo', file);
      form.append('mapeo', JSON.stringify(mapping));
      return change(`${path(pharmacyId)}/importaciones/vista-previa`, 'POST', form, false);
    },
    confirm: (pharmacyId, importId) =>
      change(`${path(pharmacyId)}/importaciones/${encodeURIComponent(importId)}/confirmar`, 'POST'),
    imports: pharmacyId => get(`${path(pharmacyId)}/importaciones`),
    importStatus: (pharmacyId, importId) =>
      get(`${path(pharmacyId)}/importaciones/${encodeURIComponent(importId)}`),
  };
}
