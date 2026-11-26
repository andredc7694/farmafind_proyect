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
const excludedReasons = { FILA_DUPLICADA: 'Duplicada', REFERENCIA_NO_CONCILIADA: 'Pendiente de catálogo' };
const isPreviewOnly = item => item.estado === 'VISTA_PREVIA' || item.estado === 'EXPIRADA';
const changed = change => change.added || change.priceBeforeCents !== change.priceAfterCents || change.quantityBefore !== change.quantityAfter;
const plain = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-PE');

/** Tabla de lo que cambió, con búsqueda por nombre y páginas. */
function Changes({ changes, unchanged }) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const matches = changes.filter(change => plain(change.nombre).includes(plain(query.trim())));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages - 1);
  return <>
    {changes.length > 0 && <>
      <label>Buscar en los cambios por nombre
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} /></label>
      <p role="status">{matches.length} de {changes.length} productos con cambios.</p>
      <div className="table-scroll"><table className="data-table">
        <caption>Qué cambió</caption>
        <thead><tr><th>Producto</th><th>Concentración</th><th>Presentación</th><th>Precio anterior</th><th>Precio nuevo</th>
          <th>Stock anterior</th><th>Stock nuevo</th><th>Cambio</th></tr></thead>
        <tbody>{matches.slice(current * pageSize, (current + 1) * pageSize).map((change, index) =>
          <tr key={`${change.nombre}-${change.concentracion}-${change.presentacion}-${index}`}>
            <td>{productName(change.nombre)}</td><td>{change.concentracion}</td><td>{change.presentacion}</td>
            <td>{change.added ? '—' : soles(change.priceBeforeCents)}</td><td>{soles(change.priceAfterCents)}</td>
            <td>{change.added ? '—' : change.quantityBefore}</td><td>{change.quantityAfter}</td>
            <td>{change.added ? 'Agregado' : 'Actualizado'}</td>
          </tr>)}</tbody>
      </table></div>
      <Pager label="Páginas de cambios" page={current} pages={pages} onPage={setPage} />
    </>}
    {unchanged > 0 && <p>{unchanged} {unchanged === 1 ? 'producto venía' : 'productos venían'} con el mismo precio y stock: sin cambios.</p>}
  </>;
}

/** Filas que el usuario dejó fuera al confirmar: número de fila y motivo. */
function Excluded({ rows }) {
  const [page, setPage] = useState(0);
  if (rows.length === 0) return null;
  const pages = Math.ceil(rows.length / pageSize);
  return <details>
    <summary>Filas excluidas por tu decisión: {rows.length}. Ver cuáles</summary>
    <div className="table-scroll"><table className="data-table">
      <caption>Filas excluidas por decisión del usuario</caption>
      <thead><tr><th>Fila del archivo</th><th>Motivo</th></tr></thead>
      <tbody>{rows.slice(page * pageSize, (page + 1) * pageSize).map(row =>
        <tr key={row.fila}><td>{row.fila}</td><td>{excludedReasons[row.motivo] ?? 'Excluida'}</td></tr>)}</tbody>
    </table></div>
    <Pager label="Páginas de filas excluidas" page={page} pages={pages} onPage={setPage} />
  </details>;
}

function Detail({ detail, confirmed }) {
  if (confirmed) {
    const all = detail.cambios ?? [];
    const changes = all.filter(changed);
    return <>
      <Changes changes={changes} unchanged={all.length - changes.length} />
      <Excluded rows={detail.excluidas ?? []} />
    </>;
  }
  const groups = groupIncidents(detail.incidencias ?? []);
  return <>
    <p>No se guardó nada en el inventario.</p>
    {groups.length > 0 && <ul>{groups.map(group => <li key={group.key}>{group.title}: {group.items.length}
      {group.items.length === 1 ? ' fila' : ' filas'} ({group.items.slice(0, 10).map(item => item.line).join(', ')}
      {group.items.length > 10 ? '…' : ''}). {group.action}.</li>)}</ul>}
  </>;
}

function Counts({ item }) {
  const rows = [['Filas del archivo', item.filas]];
  if (item.estado === 'CONFIRMADA') {
    rows.push(['Importadas', item.importadas], ['Excluidas por tu decisión', item.excluidas],
      ['Pendientes de catálogo', item.pendientes], ['Con errores', item.conErrores],
      ['Productos agregados', item.agregados], ['Productos actualizados', item.actualizados],
      ['Sin cambios', Math.max(0, item.importadas - item.agregados - item.actualizados)]);
  } else {
    rows.push(['Listas', item.listas], ['Duplicadas', item.duplicadas], ['Pendientes de catálogo', item.pendientes],
      ['Con errores', item.conErrores]);
  }
  return <p>{rows.map(([label, value]) => `${label}: ${value}`).join(' · ')}</p>;
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
    <Counts item={item} />
    {onDetail && !isPreviewOnly(item) && <button type="button" aria-expanded={state === 'open'} onClick={() => void toggle()}>
      {state === 'open' ? 'Ocultar detalle' : 'Ver detalle'}</button>}
    {state === 'loading' && <p role="status">Cargando detalle…</p>}
    {state === 'error' && <p role="alert">No se pudo cargar el detalle.</p>}
    {state === 'open' && <Detail detail={detail} confirmed={item.estado === 'CONFIRMADA'} />}
  </li>;
}

/** De la más reciente a la más antigua; las vistas previas sin confirmar quedan agrupadas y sin cambios. */
export function ImportHistory({ records, onDetail, authorName = () => null }) {
  const author = item => (item.porMi ? 'Tú' : authorName(item.autorId) ?? 'Otra persona de tu farmacia');
  const ordered = [...records].sort((a, b) => Date.parse(b.creadaEn) - Date.parse(a.creadaEn));
  const saved = ordered.filter(item => !isPreviewOnly(item));
  const previews = ordered.filter(isPreviewOnly);
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
