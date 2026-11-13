import React from 'react';

export function ImportHistory({ records }) {
  return <section aria-labelledby="import-history-title">
    <h2 id="import-history-title">Historial de importaciones</h2>
    {records.length === 0 ? <p>Sin importaciones registradas en esta farmacia.</p> :
      <ul>{records.map(item => <li key={item.importacionId}>
        {item.estado} — {new Date(item.creadaEn).toLocaleString('es-PE')}
        {item.errores > 0 && ` — ${item.errores} incidencias`}
      </li>)}</ul>}
  </section>;
}
