import React, { useEffect, useState } from 'react';

const label = item => `${item.nombre} — ${item.concentracion} — ${item.presentacion}`;

/** Revisión física manual de un producto: se abre desde un botón secundario del inventario. */
export function ManualReview({ client, product = null, busy, onSave }) {
  const [catalog, setCatalog] = useState([]);
  const [available, setAvailable] = useState(true);
  const [query, setQuery] = useState('');
  const [medicationId, setMedicationId] = useState(product?.medicamentoId ?? '');
  const [price, setPrice] = useState(product ? String(product.precioReferencial) : '');
  const [quantity, setQuantity] = useState(product ? String(product.cantidadFisica) : '');
  const [reason, setReason] = useState('');

  async function search(text) {
    try { setCatalog(await client.catalog(text)); setAvailable(true); }
    catch { setCatalog([]); setAvailable(false); }
  }
  useEffect(() => { void search(''); }, [client]);

  const options = product && !catalog.some(item => item.id === product.medicamentoId)
    ? [{ ...product, id: product.medicamentoId }, ...catalog] : catalog;

  return <div className="surface-card">
    {!available && <p role="status">Catálogo no disponible para esta sesión.</p>}
    <form onSubmit={event => { event.preventDefault(); void search(query); }}>
      <label htmlFor="catalog-query">Buscar referencia del catálogo</label>
      <input id="catalog-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
      <button type="submit" disabled={busy}>Buscar</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); void onSave(medicationId, {
      precioReferencial: Number(price), cantidadFisica: Number(quantity), motivo: reason,
    }).then(saved => { if (saved) setReason(''); }); }}>
      <h3>Revisión física manual</h3>
      <label htmlFor="inventory-medication">Medicamento</label>
      <select id="inventory-medication" required value={medicationId} onChange={event => setMedicationId(event.target.value)}>
        <option value="">Selecciona una referencia</option>
        {options.map(item => <option key={item.id} value={item.id}>{label(item)}</option>)}
      </select>
      <label htmlFor="inventory-price">Precio referencial (S/)</label>
      <input id="inventory-price" type="number" min="0" step="0.01" required value={price}
        onChange={event => setPrice(event.target.value)} />
      <label htmlFor="inventory-quantity">Cantidad física revisada</label>
      <input id="inventory-quantity" type="number" min="0" step="1" required value={quantity}
        onChange={event => setQuantity(event.target.value)} />
      <label htmlFor="inventory-reason">Motivo de revisión</label>
      <input id="inventory-reason" required maxLength={240} value={reason} onChange={event => setReason(event.target.value)} />
      <button type="submit" disabled={busy}>Guardar revisión</button>
    </form>
  </div>;
}
