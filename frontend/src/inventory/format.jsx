import React from 'react';

export const soles = cents => (cents === null || cents === undefined ? '—' : `S/ ${(Number(cents) / 100).toFixed(2)}`);
export const dateTime = value => new Date(value).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' });
/** El catálogo guarda en minúsculas; en pantalla se muestra con mayúscula inicial. */
export const productName = value => (value ? value.charAt(0).toLocaleUpperCase('es-PE') + value.slice(1) : 'Producto sin nombre');

export function Pager({ label, page, pages, onPage }) {
  if (pages <= 1) return null;
  return <nav aria-label={label}>
    <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)}>Anterior</button>
    <span> Página {page + 1} de {pages} </span>
    <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)}>Siguiente</button>
  </nav>;
}
