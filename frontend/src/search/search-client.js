function failure(response) {
  if (response.status === 429) return new Error('Se alcanzó el límite temporal de consultas. Inténtalo nuevamente.');
  if (response.status === 400 || response.status === 422) return new Error('Revisa los criterios de búsqueda.');
  return new Error('La búsqueda no está disponible temporalmente.');
}

export function createPublicSearchClient(fetchImpl = fetch) {
  return { /** F08.1: sugerencias de nombre/presentación; si falla, la búsqueda sigue funcionando sin ellas. */
    suggest: async text => {
      const response = await fetchImpl(`/api/v1/busquedas/sugerencias?${new URLSearchParams({ q: text })}`, { cache: 'no-store' });
      if (!response.ok) throw failure(response);
      const data = await response.json();
      return Array.isArray(data.suggestions) ? data.suggestions : [];
    },
    search: async criteria => {
    const params = new URLSearchParams();
    Object.entries(criteria).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) params.set(key, String(value));
    });
    const response = await fetchImpl(`/api/v1/busquedas?${params}`, { cache: 'no-store' });
    if (!response.ok) throw failure(response);
    return response.json();
  } };
}
