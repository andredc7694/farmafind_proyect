/**
 * F07.2 (D-01 A): regla única de «Reemplazada», compartida por todas las consultas del revisor. Una propuesta `p`
 * PENDIENTE está reemplazada si existe otra más nueva (por propuesta_at y luego id) de la misma farmacia, en cualquier
 * estado. Es la misma regla que `replacedProposals` (application/location-status.ts) para el historial del dueño.
 * Solo lectura; las filas visibles las decide RLS (F07 002, 007 y 009).
 */
export const NEWER_PROPOSAL_EXISTS = `EXISTS (SELECT 1 FROM f07.ubicacion_propuesta n
  WHERE n.farmacia_id=p.farmacia_id AND (n.propuesta_at,n.id) > (p.propuesta_at,p.id))`;

/** Fecha de la propuesta inmediatamente más nueva (cuándo quedó reemplazada). */
export const REPLACED_AT = `(SELECT min(n.propuesta_at) FROM f07.ubicacion_propuesta n
  WHERE n.farmacia_id=p.farmacia_id AND (n.propuesta_at,n.id) > (p.propuesta_at,p.id))`;

export const REPLACED_REASON = 'Se envió una propuesta más reciente';
