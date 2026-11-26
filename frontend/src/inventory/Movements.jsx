import React, { useState } from 'react';
import { Pager, dateTime, productName, soles } from './format.jsx';

const pageSize = 25;
const knownReasons = {
  ENTREGA_RESERVA: 'Entrega de una reserva',
  FALTA_FISICA_RESERVA: 'Faltante físico al atender una reserva',
};

export function reasonLabel(reason) {
  if (/^Importación [0-9a-f-]{36}$/i.test(reason)) return 'Importación de archivo';
  return knownReasons[reason] ?? `Revisión manual: ${reason}`;
}

export function Movements({ items }) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pages - 1);
  return <section aria-labelledby="movements-title">
    <h2 id="movements-title">Movimientos recientes</h2>
    {items.length === 0 ? <p role="status">Sin movimientos registrados.</p> : <>
      <div className="table-scroll"><table className="data-table">
        <caption>Cambios de precio y stock, del más nuevo al más antiguo</caption>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Motivo</th><th>Stock</th><th>Precio</th></tr></thead>
        <tbody>{items.slice(current * pageSize, (current + 1) * pageSize).map(item => <tr key={item.id}>
          <td>{item.occurred_at ? dateTime(item.occurred_at) : '—'}</td>
          <td>{productName(item.nombre)}{item.concentracion ? `, ${item.concentracion}` : ''}</td>
          <td>{reasonLabel(item.motivo)}</td>
          <td>{item.cantidad_antes ?? '—'} → {item.cantidad_despues}</td>
          <td>{soles(item.precio_antes_centavos)} → {soles(item.precio_despues_centavos)}</td>
        </tr>)}</tbody>
      </table></div>
      <Pager label="Páginas de movimientos" page={current} pages={pages} onPage={setPage} />
    </>}
  </section>;
}
