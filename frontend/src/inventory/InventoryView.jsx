import React, { useEffect, useState } from 'react';
import { createInventoryClient } from './inventory-client.js';
import { createStaffClient } from '../identity/staff-client.js';
import { ImportPreview } from './ImportPreview.jsx';
import { ImportHistory } from './ImportHistory.jsx';
import { InventoryTable } from './InventoryTable.jsx';
import { Movements } from './Movements.jsx';

const client = createInventoryClient();
const staffClient = createStaffClient();

/** Cada sección lee solo lo que muestra. Sin sección (ruta de inventario) se muestran todas. */
const sectionReads = { inventario: ['inventory'], importar: [], importaciones: ['imports'], movimientos: ['movements'] };
const allReads = ['inventory', 'movements', 'imports'];
const requiredCapability = { inventario: 'inventory.read', importar: 'inventory.read',
  importaciones: 'inventory.history', movimientos: 'inventory.history' };
const titles = { inventario: 'Inventario de la farmacia', importar: null, importaciones: null, movimientos: null };

export function InventoryView({ pharmacyId, capabilities = null, section = null }) {
  const [data, setData] = useState(null);
  const [names, setNames] = useState({});
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const reads = section ? sectionReads[section] : allReads;
  const shows = id => section === null || section === id;
  const holds = code => capabilities === null || capabilities.includes(code);

  async function load() {
    const results = await Promise.allSettled(reads.map(key => client[key](pharmacyId)));
    return Object.fromEntries(reads.map((key, index) => [key,
      results[index].status === 'fulfilled' ? { ok: true, value: results[index].value } : { ok: false, value: [] }]));
  }

  useEffect(() => {
    let active = true;
    setData(null); setPreview(null); setMessage(''); setNotice(''); setNames({});
    void load().then(next => { if (active) setData(next); });
    // Los nombres del personal solo los entrega el servidor a quien lo administra.
    if (shows('importaciones') && capabilities?.includes('membership.manage')) {
      staffClient.list(pharmacyId).then(rows => {
        if (active) setNames(Object.fromEntries(rows.map(row => [row.userId, row.displayName || row.alias])));
      }).catch(() => {});
    }
    return () => { active = false; };
  }, [pharmacyId, section]);

  /** Devuelve si la operación terminó bien. */
  async function action(work) {
    setBusy(true); setMessage(''); setNotice('');
    try { await work(); setData(await load()); return true; }
    catch (error) { setMessage(error.message || 'No se pudo completar la operación.'); return false; }
    finally { setBusy(false); }
  }

  async function inspectFile(file) {
    setBusy(true); setMessage(''); setNotice('');
    try { return await client.inspect(pharmacyId, file); }
    catch (error) { setMessage(error.message || 'No se pudo analizar el archivo.'); return null; }
    finally { setBusy(false); }
  }

  if (data === null) return <p role="status">Cargando inventario autorizado…</p>;
  const denied = <p role="alert">No tienes acceso al inventario de esta farmacia.</p>;
  if (reads.length > 0 && reads.every(key => !data[key].ok)) return denied;
  if (!holds(section ? requiredCapability[section] : 'inventory.read')) return denied;
  if (section === null && !data.inventory.ok && capabilities !== null) return denied;

  const canImport = holds('inventory.import.preview');
  const title = section ? titles[section] : 'Catálogo e inventario de la farmacia';
  return <section aria-label={title ? undefined : 'Inventario de la farmacia'} aria-labelledby={title ? 'inventory-title' : undefined}>
    {title && <h2 id="inventory-title">{title}</h2>}
    {message && <p role="alert">{message}</p>}
    {notice && <p role="status">{notice}</p>}
    {shows('inventario') && (data.inventory.ok
      ? <InventoryTable items={data.inventory.value} client={client} busy={busy} canWrite={holds('inventory.write')}
          onSave={(medicationId, body) => action(async () => { await client.review(pharmacyId, medicationId, body); })} />
      : <p role="status">Consulta de existencias no disponible para esta sesión.</p>)}
    {shows('importar') && canImport && <ImportPreview preview={preview} busy={busy} error={message}
      onReset={() => { setPreview(null); setNotice(''); }}
      canConfirm={holds('inventory.import.confirm')}
      onInspect={inspectFile}
      onProfiles={() => client.profiles(pharmacyId)}
      onSaveProfile={(importId, name) => client.saveProfile(pharmacyId, importId, name)}
      onPreview={(file, mapping, selection) => action(async () => {
        setPreview(await (selection ? client.previewSelected(pharmacyId, file, mapping, selection)
          : client.preview(pharmacyId, file, mapping)));
      })}
      onConfirm={(importId, exclusion) => action(async () => {
        const total = preview?.filas.length ?? 0;
        await (exclusion ? client.confirm(pharmacyId, importId, exclusion) : client.confirm(pharmacyId, importId));
        setPreview(null);
        const left = exclusion ? exclusion.duplicadas + exclusion.pendientes : 0;
        setNotice(`Importación confirmada. ${left ? `Filas importadas: ${total - left}; excluidas por tu decisión: ${left}. ` : ''}` +
          'Revisa los productos en «Inventario» y lo que cambió en «Historial».');
      })} />}
    {shows('importaciones') && (data.imports.ok
      ? <ImportHistory records={data.imports.value} authorName={id => names[id] ?? null}
          onDetail={importId => client.importStatus(pharmacyId, importId)} />
      : <p role="status">Historial de importaciones no disponible para esta sesión.</p>)}
    {shows('movimientos') && data.movements.ok && <Movements items={data.movements.value} />}
  </section>;
}
