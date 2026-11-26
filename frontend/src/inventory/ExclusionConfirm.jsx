import React, { useState } from 'react';

const excludable = ['FILA_DUPLICADA', 'REFERENCIA_NO_CONCILIADA'];

/** Conteos de la vista previa; «distintas» son duplicadas cuyo precio o stock no coincide con la primera fila. */
export function exclusionSummary(rows) {
  const first = new Map();
  let ready = 0; let duplicated = 0; let pending = 0; let blocking = 0; let different = 0;
  for (const row of rows) {
    if (row.medicationId && !first.has(row.medicationId)) first.set(row.medicationId, row);
    if (row.errorCode === null) ready++;
    else if (!excludable.includes(row.errorCode)) blocking++;
    else if (row.errorCode === 'REFERENCIA_NO_CONCILIADA') pending++;
    else {
      duplicated++;
      const original = row.medicationId ? first.get(row.medicationId) : null;
      if (original && (original.priceCents !== row.priceCents || original.physicalQuantity !== row.physicalQuantity)) different++;
    }
  }
  return { ready, duplicated, pending, blocking, different };
}

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`;

/** Exclusión explícita: se muestran los números exactos y hay que aceptarlos; cancelar no cambia nada. */
export function ExclusionConfirm({ rows, busy, onConfirm }) {
  const [asking, setAsking] = useState(false);
  const { ready, duplicated, pending, blocking, different } = exclusionSummary(rows);
  const excluded = duplicated + pending;

  if (blocking > 0) return <p>Hay {plural(blocking, 'fila con errores de datos', 'filas con errores de datos')}:
    corrígelas en el archivo. Esas filas no se pueden excluir.</p>;
  if (excluded === 0 || ready === 0) return excluded > 0 ? <p>No hay ninguna fila lista para confirmar.</p> : null;

  const what = [duplicated && `${duplicated} por revisar (duplicadas)`, pending && `${pending} de pendientes de catálogo`]
    .filter(Boolean).join(' y ');
  const kind = duplicated && pending ? `(${what})` : duplicated ? 'por revisar' : 'de pendientes de catálogo';
  const label = `Excluir ${excluded === 1 ? 'la fila' : `las ${excluded} filas`} ${kind} y confirmar ${ready === 1 ? 'la fila lista' : `las ${ready} listas`}`;

  if (!asking) return <p><button type="button" disabled={busy} onClick={() => setAsking(true)}>{label}</button></p>;
  return <div className="surface-card" role="group" aria-label="Confirmar exclusión">
    <p><strong>Se importarán {plural(ready, 'fila', 'filas')} y quedarán fuera {plural(excluded, 'fila', 'filas')}</strong>{duplicated && pending ? `: ${what}.` : duplicated ? ' por revisar (duplicadas).' : ' de pendientes de catálogo.'}</p>
    {duplicated > 0 && <p>De cada producto repetido se importa solo la primera fila.
      {different > 0 && ` En ${plural(different, 'fila repetida', 'filas repetidas')} el precio o el stock es distinto al de la primera: esos valores no se importan.`}</p>}
    <p>Las filas excluidas no crean productos ni stock. Se guarda todo lo demás o no se guarda nada.</p>
    <button type="button" disabled={busy} onClick={() => void onConfirm({ duplicadas: duplicated, pendientes: pending })}>
      Sí, excluir {excluded} y confirmar {ready}</button>{' '}
    <button type="button" className="secondary-button" disabled={busy} onClick={() => setAsking(false)}>Cancelar</button>
  </div>;
}
