/** Sprint 2 (k6): límite público por IP y minuto para una copia temporal de carga.
 *  Sin valor, devuelve el límite estándar (60 búsqueda y cercanas, 120 sugerencias): la DEMO no cambia.
 *  Con valor, exige la copia TEST aislada (geolocationTest) y un entero entre 1 y 10 000 000. */
export function resolvePublicRateLimit(standard: number, loadLimit: number | undefined, isolatedTest: boolean): number {
  if (loadLimit === undefined) return standard;
  if (!isolatedTest || !Number.isInteger(loadLimit) || loadLimit < 1 || loadLimit > 10_000_000) {
    throw new Error('Límite de carga: solo copia TEST aislada y entero entre 1 y 10 000 000');
  }
  return loadLimit;
}
