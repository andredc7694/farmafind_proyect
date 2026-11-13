import React, { useEffect, useState } from 'react';
import { createInventoryClient } from './inventory-client.js';
import { ImportPreview } from './ImportPreview.jsx';
import { ImportHistory } from './ImportHistory.jsx';

const client = createInventoryClient();

export function InventoryView({ pharmacyId }) {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [catalog, setCatalog] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [movements, setMovements] = useState([]);
  const [imports, setImports] = useState([]);
  const [access, setAccess] = useState({ catalog: false, inventory: false, movements: false, imports: false });
  const [preview, setPreview] = useState(null);
  const [query, setQuery] = useState('');
  const [medicationId, setMedicationId] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  async function reload(search = query) {
    const results = await Promise.allSettled([
      client.catalog(search), client.inventory(pharmacyId), client.movements(pharmacyId), client.imports(pharmacyId),
    ]);
    const flags = Object.fromEntries(['catalog', 'inventory', 'movements', 'imports']
      .map((key, index) => [key, results[index].status === 'fulfilled']));
    setAccess(flags);
    setCatalog(results[0].status === 'fulfilled' ? results[0].value : []);
    setInventory(results[1].status === 'fulfilled' ? results[1].value : []);
    setMovements(results[2].status === 'fulfilled' ? results[2].value : []);
    setImports(results[3].status === 'fulfilled' ? results[3].value : []);
    setStatus(Object.values(flags).some(Boolean) ? 'ready' : 'denied');
  }

  useEffect(() => {
    let active = true;
    setStatus('loading'); setPreview(null); setMessage('');
    Promise.allSettled([client.catalog(), client.inventory(pharmacyId),
      client.movements(pharmacyId), client.imports(pharmacyId)]).then(results => {
      if (!active) return;
      const flags = Object.fromEntries(['catalog', 'inventory', 'movements', 'imports']
        .map((key, index) => [key, results[index].status === 'fulfilled']));
      setAccess(flags);
      setCatalog(results[0].status === 'fulfilled' ? results[0].value : []);
      setInventory(results[1].status === 'fulfilled' ? results[1].value : []);
      setMovements(results[2].status === 'fulfilled' ? results[2].value : []);
      setImports(results[3].status === 'fulfilled' ? results[3].value : []);
      setStatus(Object.values(flags).some(Boolean) ? 'ready' : 'denied');
    });
    return () => { active = false; };
  }, [pharmacyId]);

  async function action(work) {
    setBusy(true); setMessage('');
    try { await work(); await reload(); }
    catch (error) { setMessage(error.message || 'No se pudo completar la operación.'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <p role="status">Cargando inventario autorizado…</p>;
  if (status === 'denied') return <p role="alert">No tienes acceso al inventario de esta farmacia.</p>;
  return <section aria-labelledby="inventory-title">
    <h2 id="inventory-title">Catálogo e inventario de la farmacia</h2>
    {message && <p role="alert">{message}</p>}
    {!access.catalog && <p role="status">Catálogo no disponible para esta sesión.</p>}
    <form onSubmit={event => { event.preventDefault(); void action(async () => {
      setCatalog(await client.catalog(query));
    }); }}>
      <label htmlFor="catalog-query">Buscar referencia del catálogo</label>
      <input id="catalog-query" value={query} onChange={event => setQuery(event.target.value)} maxLength={120} />
      <button type="submit" disabled={busy}>Buscar</button>
    </form>
    <form onSubmit={event => { event.preventDefault(); void action(async () => {
      await client.review(pharmacyId, medicationId, {
        precioReferencial: Number(price), cantidadFisica: Number(quantity), motivo: reason,
      });
      setReason('');
    }); }}>
      <h3>Revisión física manual</h3>
      <label htmlFor="inventory-medication">Medicamento</label>
      <select id="inventory-medication" required value={medicationId}
        onChange={event => setMedicationId(event.target.value)}>
        <option value="">Selecciona una referencia</option>
        {catalog.map(item => <option key={item.id} value={item.id}>
          {item.nombre} — {item.concentracion} — {item.presentacion}
        </option>)}
      </select>
      <label htmlFor="inventory-price">Precio referencial (S/)</label>
      <input id="inventory-price" type="number" min="0" step="0.01" required value={price}
        onChange={event => setPrice(event.target.value)} />
      <label htmlFor="inventory-quantity">Cantidad física revisada</label>
      <input id="inventory-quantity" type="number" min="0" step="1" required value={quantity}
        onChange={event => setQuantity(event.target.value)} />
      <label htmlFor="inventory-reason">Motivo de revisión</label>
      <input id="inventory-reason" required maxLength={240} value={reason}
        onChange={event => setReason(event.target.value)} />
      <button type="submit" disabled={busy}>Guardar revisión</button>
    </form>
    <h3>Existencias propias</h3>
    {!access.inventory && <p role="status">Consulta de existencias no disponible para esta sesión.</p>}
    {inventory.length === 0 ? <p>Sin existencias registradas.</p> : <table><thead><tr>
      <th>Referencia</th><th>Precio</th><th>Física</th><th>Comprometida</th><th>Última revisión</th>
    </tr></thead><tbody>{inventory.map(item => <tr key={item.id}>
      <td>{catalog.find(ref => ref.id === item.medicamentoId)?.nombre ?? item.medicamentoId}</td>
      <td>S/ {item.precioReferencial.toFixed(2)}</td><td>{item.cantidadFisica}</td>
      <td>{item.cantidadComprometida}</td><td>{new Date(item.ultimaRevision).toLocaleString('es-PE')}</td>
    </tr>)}</tbody></table>}
    <ImportPreview preview={preview} busy={busy}
      onPreview={(file, mapping) => action(async () => { setPreview(await client.preview(pharmacyId, file, mapping)); })}
      onConfirm={importId => action(async () => { await client.confirm(pharmacyId, importId); setPreview(null); })} />
    {access.imports ? <ImportHistory records={imports} /> :
      <p role="status">Historial de importaciones no disponible para esta sesión.</p>}
    <section aria-labelledby="movements-title"><h2 id="movements-title">Movimientos recientes</h2>
      <ul>{movements.map(item => <li key={item.id}>{item.motivo} — {item.cantidad_antes} → {item.cantidad_despues}</li>)}</ul>
    </section>
  </section>;
}
