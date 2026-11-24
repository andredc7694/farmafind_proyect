/** F04.1: preferencia de recogida (solo orientación; no es una cita y no cambia el vencimiento). El servidor valida de nuevo. */
export const preferenceChoices = [
  { value: 'none', label: 'Sin preferencia' },
  { value: '30', label: 'En unos 30 minutos' },
  { value: '60', label: 'En unos 60 minutos' },
  { value: '120', label: 'En unos 120 minutos' },
  { value: 'window', label: 'En una franja de hoy…' },
];

const atToday = (time, now) => {
  const match = /^(\d{2}):(\d{2})$/.exec(time ?? '');
  if (!match) return null;
  const date = new Date(now); date.setHours(Number(match[1]), Number(match[2]), 0, 0);
  return date;
};

/** Devuelve { ok:true, value } (value=undefined si no hay preferencia) o { ok:false, error } con un mensaje claro. */
export function buildPreference({ kind, start, end }, now = new Date()) {
  if (kind === 'none' || kind === undefined) return { ok: true, value: undefined };
  if (['30', '60', '120'].includes(kind)) return { ok: true, value: { type: 'MINUTES', minutes: Number(kind) } };
  if (kind === 'window') {
    const from = atToday(start, now); const to = atToday(end, now);
    if (!from || !to) return { ok: false, error: 'Indica la hora de inicio y de fin de la franja.' };
    const minutes = (to - from) / 60000;
    if (minutes < 15 || minutes > 120) return { ok: false, error: 'La franja debe durar entre 15 y 120 minutos.' };
    if (from.getTime() < now.getTime() - 60000) return { ok: false, error: 'La franja no puede empezar en el pasado.' };
    return { ok: true, value: { type: 'WINDOW', start: from.toISOString(), end: to.toISOString() } };
  }
  return { ok: false, error: 'Preferencia no válida.' };
}

export function describePreference(preference, locale = 'es-PE') {
  if (!preference) return null;
  if (preference.type === 'MINUTES') return `Preferencia estimada: en unos ${preference.minutes} minutos (no es una cita)`;
  const format = iso => new Date(iso).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  return `Preferencia estimada: entre ${format(preference.start)} y ${format(preference.end)} (no es una cita)`;
}
