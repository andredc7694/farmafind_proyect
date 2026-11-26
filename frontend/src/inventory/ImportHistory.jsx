import React, { useState } from 'react';
import { groupIncidents } from './PreviewResults.jsx';
import { Pager, dateTime, productName, soles } from './format.jsx';

const pageSize = 50;
const results = {
  CONFIRMADA: 'Confirmada',
  RECHAZADA: 'Rechazada',
  VISTA_PREVIA: 'Solo vista previa, no se guardó',
  EXPIRADA: 'Solo vista previa, no se guardó',
};
const isPreviewOnly = item => item.estado === 'VISTA_PREVIA' || item.estado === 'EXPIRADA';

const changed = change => change.added || change.priceBeforeCents !== change.priceAfterCents || change.quantityBefore !== change.quantityAfter;

function Detail({ detail }) {
  const [page, setPage] = useState(0);
  const all = detail.cambios ?? [];
  const changes = all.filter(changed);
  const unchanged = all.length - changes.length;
  const groups = groupIncidents(detail.incidencias ?? []);
  const pages = Math.max(1, Math.ceil(changes.length / pageSize));
  return <>
    {changes.length > 0 && <>
      <div className="table-scroll"><table className="data-table">
        <caption>Qué cambió</caption>
        <thead><tr><th>Producto</th><th>Cambio</th><th>Precio anterior</th><th>Precio nuevo</th><th>Stock anterior</th><th>Stock nuevo</th></tr></thead>
        <tbody>{changes.slice(page * pageSize, (page + 1) * pageSize).map((change, index) => <tr key={`${change.nombre}-${index}`}>
          <td>{productName(change.nombre)}, {change.concentracion}, {change.presentacion}</td>
          <td>{change.added ? 'Agregado' : 'Actualizado'}</td>
          <td>{change.added ? '—' : soles(change.priceBeforeCents)}</td><td>{soles(change.priceAfterCents)}</td>
          <td>{change.added ? '—' : change.quantityBefore}</td><td>{change.quantityAfter}</td>
        </tr>)}</tbody>
      </table></div>
      <Pager label="Páginas de cambios" page={page} pages={pages} onPage={setPage} />
    </>}
    {groups.length > 0 && <ul>{groups.map(group => <li key={group.key}>{group.title}: {group.items.length}
      {group.items.length === 1 ? ' fila' : ' filas'} ({group.items.slice(0, 10).map(item => item.line).join(', ')}
      {group.items.length > 10 ? '…' : ''}). {group.action}.</li>)}</ul>}
    {unchanged > 0 && <p>{unchanged} {unchanged === 1 ? 'producto venía' : 'productos venían'} con el mismo precio y stock: sin cambios.</p>}
    {all.length === 0 && groups.length === 0 && <p>No se modificó el inventario y no hay avisos que mostrar.</p>}
  </>;
}

function Card({ item, author, onDetail }) {
  const [detail, setDetail] = useState(null);
  const [state, setState] = useState('closed');
  async function toggle() {
    if (state !== 'closed') { setState('closed'); return; }
    setState('loading');
    try { setDetail(await onDetail(item.importacionId)); setState('open'); }
    catch { setState('error'); }
  }
  return <li className="surface-card">
    <p><strong>{results[item.estado] ?? 'Sin resultado'}</strong> · <time dateTime={item.creadaEn}>{dateTime(item.creadaEn)}</time></p>
    <p>Hecha por: {author(item)}</p>
    <p>Filas: {item.filas} · Listas: {item.listas} · Pendientes de catálogo: {item.pendientes} · Con errores: {item.conErrores}
      {' '}· Agregados: {item.agregados} · Actualizados: {item.actualizados}
      {item.estado === 'CONFIRMADA' && ` · Sin cambios: ${Math.max(0, item.listas - item.agregados - item.actualizados)}`}</p>
    {onDetail && <button type="button" aria-expanded={state === 'open'} onClick={() => void toggle()}>
      {state === 'open' ? 'Ocultar detalle' : 'Ver detalle'}</button>}
    {state === 'loading' && <p role="status">Cargando detalle…</p>}
    {state === 'error' && <p role="alert">No se pudo cargar el detalle.</p>}
    {state === 'open' && <Detail detail={detail} />}
  </li>;
}

/** Una tarjeta por importación; las vistas previas sin confirmar quedan agrupadas para no llenar la lista. */
export function ImportHistory({ records, onDetail, authorName = () => null }) {
  const author = item => (item.porMi ? 'Tú' : authorName(item.autorId) ?? 'Otra persona de tu farmacia');
  const saved = records.filter(item => !isPreviewOnly(item));
  const previews = records.filter(isPreviewOnly);
  const cards = items => <ul className="reservation-queue">{items.map(item =>
    <Card key={item.importacionId} item={item} author={author} onDetail={onDetail} />)}</ul>;
  return <section aria-labelledby="import-history-title">
    <h2 id="import-history-title">Historial de importaciones</h2>
    {records.length === 0 ? <p role="status">Sin importaciones registradas en esta farmacia.</p> : <>
      {saved.length === 0 ? <p>Ninguna importación confirmada o rechazada todavía.</p> : cards(saved)}
      {previews.length > 0 && <details>
        <summary>Vistas previas sin confirmar: {previews.length}. No guardaron nada. Última: {dateTime(previews[0].creadaEn)}</summary>
        {cards(previews)}
      </details>}
    </>}
  </section>;
}
