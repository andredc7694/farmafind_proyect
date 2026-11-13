import React, { useState } from 'react';

const initialMapping = { nombre: 'nombre', concentracion: 'concentracion',
  presentacion: 'presentacion', clasificacion: 'clasificacion',
  precioReferencial: 'precio', cantidadFisica: 'cantidad' };

export function ImportPreview({ onPreview, onConfirm, preview, busy }) {
  const [file, setFile] = useState(null);
  const [mapping, setMapping] = useState(initialMapping);
  function update(key, value) { setMapping(current => ({ ...current, [key]: value })); }
  return <section aria-labelledby="import-title">
    <h2 id="import-title">Importar inventario</h2>
    <p>Revisa las filas antes de confirmar. Un error bloquea el archivo completo.</p>
    <form onSubmit={event => { event.preventDefault(); if (file) void onPreview(file, mapping); }}>
      <label htmlFor="inventory-file">Archivo CSV o XLSX</label>
      <input id="inventory-file" type="file" accept=".csv,.xlsx" required
        onChange={event => setFile(event.target.files?.[0] ?? null)} />
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
      <button type="submit" disabled={busy || !file}>Preparar vista previa</button>
    </form>
    {preview && <div>
      <h3>Vista previa: {preview.estado}</h3>
      <p>Caduca: {new Date(preview.caducaEn).toLocaleString('es-PE')}</p>
      <p>{preview.filas.length} filas; {preview.errores.length} incidencias.</p>
      <ul>{preview.filas.map(row => <li key={row.line}>
        Fila {row.line}: {row.errorCode ?? `Referencia ${row.medicationId}; cantidad ${row.physicalQuantity}; precio S/ ${(row.priceCents / 100).toFixed(2)}`}
      </li>)}</ul>
      <button type="button" disabled={busy || preview.errores.length > 0}
        onClick={() => void onConfirm(preview.importacionId)}>Confirmar archivo completo</button>
    </div>}
  </section>;
}
