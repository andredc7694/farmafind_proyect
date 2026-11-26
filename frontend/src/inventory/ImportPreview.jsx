import React, { useState } from 'react';
import { PreviewResults } from './PreviewResults.jsx';

export const fieldLabels = { nombre: 'Producto', concentracion: 'Concentración', presentacion: 'Presentación',
  clasificacion: 'Clasificación (condición de venta)', precioReferencial: 'Precio', cantidadFisica: 'Stock' };
const fields = Object.keys(fieldLabels);

/**
 * Importación en un paso (enmienda F02.1): al elegir el archivo se analiza solo y se muestra la vista previa.
 * Solo se pregunta por el dato que falte o sea ambiguo; el ajuste manual queda oculto en «Ajustar columnas».
 */
export function ImportPreview({ onInspect, onProfiles, onSaveProfile, onPreview, onConfirm, onReset,
  preview, busy, canConfirm = true, error = '' }) {
  const [file, setFile] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [candidateIndex, setCandidateIndex] = useState(0);
  const [mapping, setMapping] = useState({});
  const [adjusting, setAdjusting] = useState(false);
  const [working, setWorking] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');

  const candidate = inspection?.candidatos[candidateIndex] ?? null;
  const questions = candidate ? candidate.preguntas : [];
  const complete = fields.every(field => mapping[field]);
  const selectionFor = (analysis, item) => ({ sheet: item.sheet, headerRow: item.headerRow, digest: analysis.huella });
  const compatibleProfiles = candidate ? profiles.filter(profile => profile.version === 1 &&
    profile.headerDigest === candidate.headerDigest && profile.sheet === candidate.sheet && profile.headerRow === candidate.headerRow) : [];

  async function choose(next) {
    setFile(next); setInspection(null); setMapping({}); setAdjusting(false); setCandidateIndex(0); setProfileError('');
    onReset?.();
    if (!next || !onInspect) return;
    setWorking(true);
    try {
      const analysis = await onInspect(next);
      if (!analysis) return;
      setInspection(analysis);
      const first = analysis.candidatos[0];
      if (!first) return;
      setMapping(first.mapping);
      if (onProfiles) { try { setProfiles(await onProfiles()); } catch { setProfiles([]); } }
      if (first.preguntas.length === 0) await onPreview(next, first.mapping, selectionFor(analysis, first));
    } finally { setWorking(false); }
  }
  async function revalidate(nextMapping = mapping) {
    if (!file || !candidate) return;
    setWorking(true);
    try { await onPreview(file, nextMapping, selectionFor(inspection, candidate)); }
    finally { setWorking(false); }
  }
  function chooseSheet(index) {
    setCandidateIndex(index); setMapping(inspection.candidatos[index].mapping); onReset?.();
  }
  async function saveProfile() {
    if (!preview?.importacionId || !onSaveProfile || !profileName.trim()) return;
    setProfileError('');
    try {
      const saved = await onSaveProfile(preview.importacionId, profileName.trim());
      setProfiles(current => [...current, saved]); setProfileName('');
    } catch (error) { setProfileError(error.message || 'No se pudo guardar el perfil.'); }
  }
  const columnSelect = (field, label) => <label key={field}>{label}
    <select aria-label={label} value={mapping[field] ?? ''} onChange={event => setMapping(current => ({ ...current, [field]: event.target.value }))}>
      <option value="">Elegir columna…</option>
      {candidate.headers.map(header => <option key={header} value={header}>{header}</option>)}
    </select>
  </label>;

  const pending = preview ? preview.filas.filter(row => row.errorCode === 'REFERENCIA_NO_CONCILIADA').length : 0;

  return <section aria-labelledby="import-title">
    <h2 id="import-title">Importar inventario</h2>
    <p>Elige tu archivo: lo analizamos solos y te mostramos los productos antes de guardar nada.</p>
    <label htmlFor="inventory-file">Archivo CSV o XLSX</label>
    <input id="inventory-file" type="file" accept=".csv,.xlsx" disabled={busy}
      onChange={event => void choose(event.target.files?.[0] ?? null)} />
    {working && <p role="status">Analizando el archivo…</p>}
    {!working && error && <p role="status" className="import-error">{error}</p>}

    {inspection && !candidate && <p role="alert">No encontramos columnas de inventario en ninguna hoja
      ({inspection.hojasIgnoradas?.join(', ')}). La hoja debe tener una fila de encabezados con producto, concentración,
      presentación, condición de venta, precio y stock.</p>}

    {candidate && questions.length > 0 && !preview && <fieldset>
      <legend>Solo falta esto para continuar</legend>
      {questions.map(({ campo, motivo }) => <div key={campo}>
        <p>{motivo === 'AMBIGUO' ? `Hay más de una columna posible para «${fieldLabels[campo]}».`
          : `No encontramos la columna de «${fieldLabels[campo]}» en la hoja «${candidate.sheet}».`}</p>
        {motivo === 'FALTA' && campo === 'cantidadFisica' && inspection.hojasConStock?.length > 0 && <p>
          Hay stock en otra hoja: {inspection.hojasConStock.map(item => `«${item.hoja}», columna «${item.columna}»`).join('; ')}.
          No lo combinamos automáticamente.</p>}
        {columnSelect(campo, fieldLabels[campo])}
      </div>)}
      <button type="button" disabled={busy || working || !complete} onClick={() => void revalidate()}>Continuar</button>
    </fieldset>}

    {candidate && <p><button type="button" aria-expanded={adjusting} onClick={() => setAdjusting(open => !open)}>Ajustar columnas</button></p>}
    {candidate && adjusting && <fieldset>
      <legend>Ajuste manual</legend>
      {inspection.candidatos.length > 1 && <label>Hoja
        <select value={candidateIndex} onChange={event => chooseSheet(Number(event.target.value))}>
          {inspection.candidatos.map((item, index) => <option key={`${item.sheet}-${item.headerRow}`} value={index}>{item.sheet}, fila {item.headerRow}</option>)}
        </select></label>}
      {compatibleProfiles.length > 0 && <label>Perfil compatible de esta farmacia
        <select defaultValue="" onChange={event => {
          const profile = compatibleProfiles.find(item => item.id === event.target.value);
          if (profile) setMapping(profile.mapping);
        }}>
          <option value="">Elegir…</option>
          {compatibleProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select></label>}
      {fields.map(field => columnSelect(field, fieldLabels[field]))}
      <button type="button" disabled={busy || working || !complete} onClick={() => void revalidate()}>Actualizar vista previa</button>
    </fieldset>}

    {preview && <div>
      <h3>Vista previa: {preview.estado}</h3>
      {candidate && <p>Hoja «{candidate.sheet}» · {fields.map(field => `${fieldLabels[field]}: ${mapping[field]}`).join(' · ')}</p>}
      <p>Caduca: {new Date(preview.caducaEn).toLocaleString('es-PE')}</p>
      <p>{preview.filas.length} filas; {preview.incidencias?.length ?? preview.errores.length} incidencias.</p>
      {preview.errores.length > 0 && <p>Un error bloquea el archivo completo: no se guarda nada hasta que todas las filas estén listas.
        {pending > 0 && ' Los pendientes de catálogo no existen todavía en el catálogo de FarmaFind; no se descartan ni se equiparan a otros.'}</p>}
      <PreviewResults key={preview.importacionId} preview={preview} />
      {canConfirm && <button type="button" disabled={busy || preview.errores.length > 0}
        onClick={() => void onConfirm(preview.importacionId)}>Confirmar archivo completo</button>}
      {canConfirm && onSaveProfile && candidate && preview.errores.length === 0 && <div>
        <label htmlFor="import-profile-name">Nombre del perfil de columnas</label>
        <input id="import-profile-name" maxLength={80} value={profileName} onChange={event => setProfileName(event.target.value)} />
        <button type="button" disabled={busy || !profileName.trim()} onClick={() => void saveProfile()}>Guardar perfil para esta farmacia</button>
        {profileError && <p role="alert">{profileError}</p>}
      </div>}
    </div>}
  </section>;
}
