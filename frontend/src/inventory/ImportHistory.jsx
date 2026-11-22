import React from 'react';

export function ImportHistory({ records }) {
  return <section aria-labelledby="import-history-title">
    <h2 id="import-history-title">Historial de importaciones</h2>
    {records.length === 0 ? <p role="status">Sin importaciones registradas en esta farmacia.</p> :
      <ul className="reservation-queue">{records.map(item => <li className="surface-card" key={item.importacionId}>
        <strong>{item.estado}</strong><p>Registrada: <time dateTime={item.creadaEn}>{new Date(item.creadaEn).toLocaleString('es-PE')}</time></p>
        {item.errores > 0 && <p>{item.errores} incidencias</p>}
      </li>)}</ul>}
  </section>;
}
