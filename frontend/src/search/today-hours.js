import { limaIsoDay } from '../geolocation/my-pharmacy-clients.js';

/** Hora actual de Lima en formato HH:MM. */
export function limaTime(now = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
}

/**
 * F03.1 (FR-005): estado del horario de HOY, en hora de Lima, a partir de la proyección pública de F07.1.
 * «Abierto hasta HH:MM» · «Abre a las HH:MM» · «Cerrado ahora» · «Cerrado hoy» · «Horario no publicado».
 */
export function describeToday(days, now = new Date()) {
  if (!Array.isArray(days) || days.length === 0) return 'Horario no publicado';
  const today = days.find(day => day.dia === limaIsoDay(now));
  if (!today) return 'Horario no publicado';
  if (today.cerrado) return 'Cerrado hoy';
  const opens = String(today.abre ?? '').slice(0, 5); const closes = String(today.cierra ?? '').slice(0, 5);
  if (!/^\d\d:\d\d$/.test(opens) || !/^\d\d:\d\d$/.test(closes)) return 'Horario no publicado';
  const time = limaTime(now);
  if (time < opens) return `Abre a las ${opens}`;
  if (time < closes) return `Abierto hasta ${closes}`;
  return 'Cerrado ahora';
}
