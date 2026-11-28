/** F06.2: horario público F07.1 (un tramo por día, hora de Lima). Misma lectura que «today-hours.js» de la pantalla. */
export interface PublicOpeningDay { readonly dia: number; readonly cerrado: boolean; readonly abre: string | null; readonly cierra: string | null }

const WEEKDAY: Readonly<Record<string, number>> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function limaClock(now: Date): { readonly day: number; readonly time: string } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Lima', weekday: 'short', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return { day: WEEKDAY[get('weekday')] ?? 0, time: `${get('hour')}:${get('minute')}` };
}

export function todayStatus(days: readonly PublicOpeningDay[] | undefined, now: Date): { readonly abierto: boolean; readonly texto: string } {
  if (!days?.length) return { abierto: false, texto: 'Horario no publicado' };
  const clock = limaClock(now);
  const today = days.find(day => day.dia === clock.day);
  if (!today) return { abierto: false, texto: 'Horario no publicado' };
  if (today.cerrado) return { abierto: false, texto: 'Cerrado hoy' };
  const opens = String(today.abre ?? '').slice(0, 5); const closes = String(today.cierra ?? '').slice(0, 5);
  if (!/^\d\d:\d\d$/.test(opens) || !/^\d\d:\d\d$/.test(closes)) return { abierto: false, texto: 'Horario no publicado' };
  if (clock.time < opens) return { abierto: false, texto: `Abre a las ${opens}` };
  if (clock.time < closes) return { abierto: true, texto: `Abierto hasta ${closes}` };
  return { abierto: false, texto: 'Cerrado ahora' };
}
