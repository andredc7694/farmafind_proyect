/** Puertos de las copias temporales de revisión. 3000 (API) y 5173 (web) son SIEMPRE de la DEMO de Andre:
 *  una copia nunca los toma, estén libres u ocupados. Incidente F06.2 (2026-11-27). */
import net from 'node:net';

export const DEMO_PORTS = Object.freeze([3000, 5173]);
export const COPY_DEFAULTS = Object.freeze({ apiPort: 3001, webPort: 5174 });

export class CopyPortError extends Error {}

/** Valida el número sin abrir nada: entero de usuario y nunca un puerto de la DEMO. */
export function assertCopyPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new CopyPortError(`Copia temporal detenida: el puerto de ${label} («${value}») no es válido.`);
  }
  if (DEMO_PORTS.includes(port)) {
    throw new CopyPortError(`Copia temporal detenida: el puerto ${port} es de la DEMO (3000 y 5173) y la copia no lo puede usar `
      + `para ${label}. Usa otro, por ejemplo API ${COPY_DEFAULTS.apiPort} y web ${COPY_DEFAULTS.webPort}. No se inició nada.`);
  }
  return port;
}

const answers = (port, host) => new Promise(resolve => {
  const socket = net.connect({ port, host });
  const done = value => { socket.destroy(); resolve(value); };
  socket.setTimeout(1000, () => done(false));
  socket.once('connect', () => done(true));
  socket.once('error', () => done(false));
});

/** Un puerto ocupado detiene la copia: no se toma ni se detiene el proceso que lo usa. */
export async function assertPortFree(port, label) {
  if (await answers(port, '127.0.0.1') || await answers(port, '::1')) {
    throw new CopyPortError(`Copia temporal detenida: el puerto ${port} (${label}) ya está en uso. No se inició nada ni se detuvo ningún proceso.`);
  }
}

/** Puerto de la API de una copia (lo usa su `serve.mjs`). */
export function copyApiPort(env = process.env) {
  return assertCopyPort(env.FARMAFIND_COPY_API_PORT ?? COPY_DEFAULTS.apiPort, 'la API');
}
