import React, { useState } from 'react';

const initialMapping = { nombre: 'nombre', concentracion: 'concentracion',
  presentacion: 'presentacion', clasificacion: 'clasificacion',
  precioReferencial: 'precio', cantidadFisica: 'cantidad' };

export function ImportPreview({ onInspect, onProfiles, onSaveProfile, onPreview, onConfirm, onReset,
  preview, busy, canConfirm = true }) {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState(initialMapping);
  const [inspection, setInspection] = useState(null);
  const [candidateIndex, setCandidateIndex] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  function update(key, value) { setMapping(current => ({ ...current, [key]: value })); }
  async function inspect() {
    if (!file || !onInspect) return;
    onReset?.();
    setInspection(null); setCandidateIndex('');
    const result = await onInspect(file);
    setInspection(result);
    if (result && onProfiles) {
      try { setProfiles(await onProfiles()); }
      catch { setProfiles([]); }
    }
  }
  function chooseCandidate(index) {
    setCandidateIndex(index);
    const candidate = inspection?.candidatos[Number(index)];
    if (candidate) setMapping(current => ({ ...current, ...candidate.mapping,
      ...Object.fromEntries(candidate.ambiguous.map(field => [field, ''])) }));
  }
  const candidate = candidateIndex === '' ? null : inspection?.candidatos[Number(candidateIndex)];
  const selection = candidate ? { sheet: candidate.sheet, headerRow: candidate.headerRow,
    digest: inspection.huella } : undefined;
  const compatibleProfiles = candidate ? profiles.filter(profile =>
    profile.version === 1 && profile.headerDigest === candidate.headerDigest && profile.sheet === candidate.sheet &&
    profile.headerRow === candidate.headerRow) : [];
  async function saveProfile() {
    if (!preview?.importacionId || !onSaveProfile || !profileName.trim()) return;
    setProfileError('');
    try {
      const saved = await onSaveProfile(preview.importacionId, profileName.trim());
      setProfiles(current => [...current, saved]); setProfileName('');
    } catch (error) { setProfileError(error.message || 'No se pudo guardar el perfil.'); }
  }
  return <section aria-labelledby="import-title">
    <h2 id="import-title">Importar inventario</h2>
    <p>Revisa las filas antes de confirmar. Un error bloquea el archivo completo.</p>
    <p><a href="/plantilla-inventario-demo.csv" download="plantilla-inventario-demo.csv">Descargar plantilla CSV de demostración</a></p>
    <form onSubmit={event => { event.preventDefault(); if (file && (!inspection || selection))
      void onPreview(file, mapping, selection); }}>
      <label htmlFor="inventory-file">Archivo CSV o XLSX</label>
      <input id="inventory-file" type="file" accept=".csv,.xlsx" required
        onChange={event => { setFile(event.target.files?.[0] ?? null); setInspection(null);
          setCandidateIndex(''); setProfiles([]); onReset?.(); }} />
      {onInspect && <button type="button" disabled={busy || !file} onClick={() => void inspect()}>
        Analizar hojas y encabezados</button>}
      {inspection && <div role="status">
        <label htmlFor="inventory-candidate">Hoja y fila de encabezado</label>
        <select id="inventory-candidate" value={candidateIndex}
          onChange={event => chooseCandidate(event.target.value)}>
          <option value="">Selecciona una opción para revisar</option>
          {inspection.candidatos.map((item, index) => <option key={`${item.sheet}-${item.headerRow}`}
            value={index}>{item.sheet}, fila {item.headerRow} ({item.matchedFields} campos reconocidos)</option>)}
        </select>
        {candidate?.ambiguous.length > 0 && <p>Columnas ambiguas: {candidate.ambiguous.join(', ')}.
          Corrige manualmente su correspondencia antes de continuar.</p>}
        {compatibleProfiles.length > 0 && <label>Perfil compatible de esta farmacia
          <select defaultValue="" onChange={event => {
            const profile = compatibleProfiles.find(item => item.id === event.target.value);
            if (profile) setMapping(profile.mapping);
          }}>
            <option value="">Elegir tras revisar columnas</option>
            {compatibleProfiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
          </select>
        </label>}
        {inspection.candidatos.length === 0 && <p>No se identificaron encabezados utilizables.
          Revisa el archivo o utiliza un formato admitido.</p>}
      </div>}
      <fieldset><legend>Correspondencia de columnas</legend>
        {Object.keys(initialMapping).map(key => <label key={key}>{key}
          <input value={mapping[key]} onChange={event => update(key, event.target.value)} required />
        </label>)}
        <label>Columna de farmacia (opcional)
          <input value={mapping.farmaciaId ?? ''} onChange={event => {
            const value = event.target.value;
            setMapping(current => { const next = { ...current }; if (value) next.farmaciaId = value;
              else delete next.farmaciaId; return next; });
          }} />
        </label>
      </fieldset>
      <button type="submit" disabled={busy || !file || (inspection && !selection)}>
        Preparar vista previa</button>
    </form>
    {preview && <div>
      <h3>Vista previa: {preview.estado}</h3>
      <p>Caduca: {new Date(preview.caducaEn).toLocaleString('es-PE')}</p>
      <p>{preview.filas.length} filas; {preview.incidencias?.length ?? preview.errores.length} incidencias.</p>
      {Array.isArray(preview.incidencias) && preview.incidencias.length > 0 && <section
        aria-label="Incidencias de importación">
        <h4>Corrige estas filas y vuelve a validar el archivo</h4>
        <ol>{preview.incidencias.map((item, index) => <li key={`${item.line}-${item.code}-${index}`}>
          <strong>Fila {item.line}, columna {item.column}, campo {item.field}: {item.title}</strong>. {item.cause}.
          {' '}{item.action}. Código {item.supportCode}.
        </li>)}</ol>
      </section>}
      <ul>{preview.filas.map(row => <li key={row.line}>
        Fila {row.line}: {row.errorCode ?? `Referencia ${row.medicationId}; cantidad ${row.physicalQuantity}; precio S/ ${(row.priceCents / 100).toFixed(2)}`}
      </li>)}</ul>
      {canConfirm && <button type="button" disabled={busy || preview.errores.length > 0}
        onClick={() => void onConfirm(preview.importacionId)}>Confirmar archivo completo</button>
      }
      {canConfirm && onSaveProfile && selection && preview.errores.length === 0 && <div>
        <label htmlFor="import-profile-name">Nombre del perfil de columnas</label>
        <input id="import-profile-name" maxLength={80} value={profileName}
          onChange={event => setProfileName(event.target.value)} />
        <button type="button" disabled={busy || !profileName.trim()} onClick={() => void saveProfile()}>
          Guardar perfil para esta farmacia</button>
        {profileError && <p role="alert">{profileError}</p>}
      </div>}
    </div>}
  </section>;
}
