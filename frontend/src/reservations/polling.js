/**
 * F04.1: sondeo de la cola de atención. Una sola petición a la vez, `setTimeout` encadenado (no se apilan),
 * pausa con la pestaña oculta, espera creciente tras fallos (30 → 60 → 120 s) y descarte de instantáneas más viejas
 * que la ya aplicada. Solo LEE: nunca ejecuta acciones. Los temporizadores se inyectan para probarlo.
 */
export function createPoller({ load, onData, onStatus = () => {}, intervalMs = 30000, maxBackoffMs = 120000,
  schedule = (fn, ms) => setTimeout(fn, ms), cancel = handle => clearTimeout(handle),
  isVisible = () => typeof document === 'undefined' || document.visibilityState !== 'hidden' }) {
  let timer = null; let stopped = true; let failures = 0; let lastGeneratedAt = 0; let inFlight = false;

  const plan = ms => { if (!stopped) timer = schedule(tick, ms); };
  async function tick() {
    timer = null;
    if (stopped) return;
    if (!isVisible()) { plan(intervalMs); return; }
    if (inFlight) return;
    inFlight = true;
    try {
      const snapshot = await load();
      if (stopped) return;
      const generated = Date.parse(snapshot.generatedAt);
      if (!(generated < lastGeneratedAt)) { lastGeneratedAt = generated; onData(snapshot); }
      failures = 0; onStatus({ state: 'ok', at: new Date() });
      plan(intervalMs);
    } catch {
      failures += 1; onStatus({ state: 'offline', failures });
      plan(Math.min(maxBackoffMs, intervalMs * 2 ** (failures - 1)));
    } finally { inFlight = false; }
  }
  return {
    start() { if (!stopped) return; stopped = false; void tick(); },
    stop() { stopped = true; if (timer !== null) cancel(timer); timer = null; },
    /** Reconexión o botón «Actualizar»: consulta ya, sin esperar el intervalo. */
    refresh() { if (stopped) return; if (timer !== null) cancel(timer); timer = null; void tick(); },
  };
}
