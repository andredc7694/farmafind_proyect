import React, { useState } from 'react';

const pageSize = 50;
const detailStep = 20;

/** Estado de cada fila: lo que está listo, lo que espera catálogo, lo que hay que revisar y lo que está mal. */
export function rowStatus(row) {
  if (row.errorCode === null) return 'listo';
  if (row.errorCode === 'REFERENCIA_NO_CONCILIADA') return 'pendiente';
  if (row.errorCode === 'FILA_DUPLICADA' || row.errorCode === 'REFERENCIA_AMBIGUA') return 'revisar';
  return 'error';
}
const statusLabel = { listo: 'Listos', pendiente: 'Pendientes de catálogo', revisar: 'Por revisar', error: 'Errores' };

/** Avisos agrupados por tipo; los pendientes de catálogo no son un aviso por fila (se ven con su filtro). */
export function groupIncidents(incidents) {
  const groups = new Map();
  for (const item of incidents) {
    if (item.code === 'REFERENCIA_NO_CONCILIADA') continue;
    const key = `${item.code}|${item.title}`;
    if (!groups.has(key)) groups.set(key, { key, title: item.title, action: item.action, items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

function IncidentGroup({ group }) {
  const [shown, setShown] = useState(detailStep);
  return <details open={group.items.length <= 5}>
    <summary><strong>{group.title}</strong>: {group.items.length} {group.items.length === 1 ? 'fila' : 'filas'}. {group.action}. <span>Ver detalle</span></summary>
    <ol>{group.items.slice(0, shown).map((item, index) => <li key={`${item.line}-${index}`}>
      <strong>Fila {item.line}, columna {item.column}, campo {item.field}: {item.title}</strong>. {item.cause}.
      {' '}{item.action}. Código {item.supportCode}.
    </li>)}</ol>
    {group.items.length > shown && <button type="button" onClick={() => setShown(current => current + detailStep)}>
      Ver más ({group.items.length - shown} restantes)</button>}
  </details>;
}

/** Resumen, luego tabla con filtros y al final los avisos agrupados: nunca una lista de cientos de líneas. */
export function PreviewResults({ preview }) {
  const [filter, setFilter] = useState('todos');
  const [page, setPage] = useState(0);
  const counts = { listo: 0, pendiente: 0, revisar: 0, error: 0 };
  for (const row of preview.filas) counts[rowStatus(row)]++;
  const rows = filter === 'todos' ? preview.filas : preview.filas.filter(row => rowStatus(row) === filter);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages - 1);
  const groups = groupIncidents(preview.incidencias ?? []);
  const choose = value => { setFilter(value); setPage(0); };

  return <>
    <section aria-label="Resumen de la vista previa">
      <p role="status">{preview.filas.length} filas en total · {counts.listo} listas · {counts.pendiente} pendientes de catálogo · {counts.revisar} por revisar · {counts.error} con errores.</p>
    </section>
    <div role="group" aria-label="Filtrar productos">
      <button type="button" aria-pressed={filter === 'todos'} onClick={() => choose('todos')}>Todos ({preview.filas.length})</button>
      {Object.keys(statusLabel).map(key => <button key={key} type="button" aria-pressed={filter === key} disabled={counts[key] === 0}
        onClick={() => choose(key)}>{statusLabel[key]} ({counts[key]})</button>)}
    </div>
    <div className="table-scroll"><table>
      <caption>Productos del archivo</caption>
      <thead><tr><th>Fila</th><th>Producto</th><th>Concentración</th><th>Presentación</th><th>Precio</th><th>Stock</th><th>Estado</th></tr></thead>
      <tbody>{rows.slice(current * pageSize, (current + 1) * pageSize).map(row => <tr key={row.line}>
        <td>{row.line}</td><td>{row.producto?.nombre ?? '—'}</td><td>{row.producto?.concentracion ?? '—'}</td><td>{row.producto?.presentacion ?? '—'}</td>
        <td>{row.priceCents === null || row.priceCents === undefined ? '—' : `S/ ${(row.priceCents / 100).toFixed(2)}`}</td>
        <td>{row.physicalQuantity ?? '—'}</td>
        <td>{row.errorCode === null ? 'Listo' : rowStatus(row) === 'pendiente' ? 'Pendiente de catálogo'
          : row.incidents?.length ? `${row.incidents.find(item => item.code !== 'REFERENCIA_NO_CONCILIADA')?.title ?? row.incidents[0].title} (${row.errorCode})` : row.errorCode}</td>
      </tr>)}</tbody>
    </table></div>
    {pages > 1 && <nav aria-label="Páginas de productos">
      <button type="button" disabled={current === 0} onClick={() => setPage(current - 1)}>Anterior</button>
      <span> Página {current + 1} de {pages} </span>
      <button type="button" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>Siguiente</button>
    </nav>}
    {groups.length > 0 && <section aria-label="Incidencias de importación">
      <h4>Avisos agrupados por tipo</h4>
      {groups.map(group => <IncidentGroup key={group.key} group={group} />)}
    </section>}
  </>;
}
