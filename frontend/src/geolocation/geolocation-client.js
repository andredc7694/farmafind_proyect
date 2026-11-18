function failure(response) {
  if (response.status === 429) return new Error('Demasiadas consultas. Inténtalo de nuevo en unos momentos.');
  if (response.status === 400) return new Error('Revisa la ciudad, las coordenadas y el radio.');
  return new Error('La consulta de farmacias no está disponible temporalmente.');
}

async function result(response) {
  if (!response.ok) throw failure(response);
  return response.json();
}

/** Public F07 client. Personal coordinates never enter URL, browser history or storage. */
export function createGeolocationClient(fetchImpl=fetch) {
  return {
    async searchCity({ city, term, page=1 }) {
      if (/^[-+]?\d+(?:\.\d+)?\s*[,; ]\s*[-+]?\d+(?:\.\d+)?$/.test(city.trim()))
        throw new Error('Introduce una ciudad, no coordenadas, en este campo.');
      const params=new URLSearchParams({ciudad:city,pagina:String(page)});
      if (term) params.set('q',term);
      return result(await fetchImpl(`/api/v1/geolocalizacion/farmacias?${params}`,{
        cache:'no-store',credentials:'omit',
      }));
    },
    async searchNearby({ latitude, longitude, radiusKm=10, term, page=1 }) {
      const body={latitud:latitude,longitud:longitude,radioKm:radiusKm,pagina:page};
      if (term) body.q=term;
      return result(await fetchImpl('/api/v1/geolocalizacion/consultas',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),
        cache:'no-store',credentials:'omit',
      }));
    },
  };
}
