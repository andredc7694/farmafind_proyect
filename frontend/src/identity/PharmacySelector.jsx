import React from 'react';

/** Presentation only: the API supplies the current, authorized pharmacy list. */
export function PharmacySelector({
  pharmacies = [],
  activePharmacyId = null,
  selectingPharmacyId = null,
  status = 'ready',
  onSelect,
}) {
  if (status === 'loading') return <p role="status">Cargando farmacias autorizadas…</p>;
  if (status === 'expired') return <p role="status">Tu sesión expiró. Inicia sesión nuevamente.</p>;
  if (status === 'denied') return <p role="status">No se pudo acceder a las farmacias autorizadas.</p>;

  return <section aria-labelledby="pharmacy-selector-title">
    <h2 id="pharmacy-selector-title">Selecciona tu farmacia</h2>
    {pharmacies.length === 0 ? <p role="status">No tienes farmacias disponibles.</p> :
      <ul>
        {pharmacies.map(({ pharmacyId, pharmacyName }) => <li key={pharmacyId}>
          <button
            type="button"
            aria-current={activePharmacyId === pharmacyId ? 'true' : undefined}
            disabled={selectingPharmacyId !== null}
            onClick={() => onSelect(pharmacyId)}
          >{pharmacyName}</button>
        </li>)}
      </ul>}
  </section>;
}
