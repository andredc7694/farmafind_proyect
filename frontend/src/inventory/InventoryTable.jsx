import React, { Fragment, useState } from 'react';
import { ManualReview } from './ManualReview.jsx';
import { Pager, dateTime, productName } from './format.jsx';

const pageSize = 25;
/** «Stock bajo»: quedan entre 1 y 5 unidades disponibles (física menos comprometida). */
export const lowStockLimit = 5;
export const available = item => item.cantidadFisica - item.cantidadComprometida;
const plain = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es-PE');
const filters = {
  todos: { label: 'Todos', match: () => true },
  sin: { label: 'Sin stock', match: item => available(item) <= 0 },
  bajo: { label: 'Stock bajo', match: item => available(item) > 0 && available(item) <= lowStockLimit },
};

/** Inventario de la farmacia activa en solo lectura, con búsqueda, filtros, paginación y detalle. */
export function InventoryTable({ items, client, busy, canWrite, onSave }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('todos');
  const [page, setPage] = useState(0);
  const [detail, setDetail] = useState(null);
  const [review, setReview] = useState(null); // null: cerrado; { product }: abierto

  const matches = items.filter(item => plain(item.nombre).includes(plain(query.trim())) && filters[filter].match(item));
  const pages = Math.max(1, Math.ceil(matches.length / pageSize));
  const current = Math.min(page, pages - 1);

  return <section aria-labelledby="stock-title">
    <h3 id="stock-title">Existencias propias</h3>
    {items.length === 0 ? <p>Sin existencias registradas.</p> : <>
      <label htmlFor="stock-query">Buscar por nombre</label>
      <input id="stock-query" type="search" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} />
      <div role="group" aria-label="Filtrar existencias">{Object.entries(filters).map(([key, option]) =>
        <button key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setPage(0); }}>
          {option.label} ({items.filter(option.match).length})</button>)}</div>
      <p role="status">{matches.length} de {items.length} productos. «Stock bajo»: de 1 a {lowStockLimit} disponibles.</p>
      <div className="table-scroll"><table className="data-table">
        <caption>Inventario de la farmacia activa</caption>
        <thead><tr><th>Producto</th><th>Concentración</th><th>Presentación</th><th>Precio</th><th>Físico</th>
          <th>Comprometido</th><th>Disponible</th><th>Última revisión</th><th>Detalle</th></tr></thead>
        <tbody>{matches.slice(current * pageSize, (current + 1) * pageSize).map(item => <Fragment key={item.id}>
          <tr>
            <td>{productName(item.nombre)}</td><td>{item.concentracion}</td><td>{item.presentacion}</td>
            <td>S/ {Number(item.precioReferencial).toFixed(2)}</td><td>{item.cantidadFisica}</td>
            <td>{item.cantidadComprometida}</td><td>{available(item)}</td><td>{dateTime(item.ultimaRevision)}</td>
            <td><button type="button" aria-expanded={detail === item.id} aria-label={`Ver ${productName(item.nombre)} ${item.concentracion}`}
              onClick={() => setDetail(open => (open === item.id ? null : item.id))}>{detail === item.id ? 'Cerrar' : 'Ver'}</button></td>
          </tr>
          {detail === item.id && <tr><td colSpan={9}>
            <dl>
              <dt>Producto</dt><dd>{productName(item.nombre)}, {item.concentracion}, {item.presentacion}</dd>
              <dt>Condición de venta</dt><dd>{item.clasificacion}</dd>
              <dt>Disponible para reservar</dt><dd>{available(item)} ({item.cantidadFisica} físicas menos {item.cantidadComprometida} comprometidas)</dd>
              <dt>Última revisión</dt><dd>{dateTime(item.ultimaRevision)}</dd>
            </dl>
            {canWrite && <button type="button" className="secondary-button" onClick={() => setReview({ product: item })}>
              Actualizar precio o stock</button>}
          </td></tr>}
        </Fragment>)}</tbody>
      </table></div>
      {matches.length === 0 && <p>Ningún producto coincide con la búsqueda o el filtro.</p>}
      <Pager label="Páginas de existencias" page={current} pages={pages} onPage={setPage} />
    </>}
    {canWrite && <p><button type="button" className="secondary-button" aria-expanded={review !== null}
      onClick={() => setReview(open => (open ? null : { product: null }))}>Revisión manual</button></p>}
    {canWrite && review && <ManualReview key={review.product?.id ?? 'nuevo'} client={client} product={review.product} busy={busy} onSave={onSave} />}
  </section>;
}
