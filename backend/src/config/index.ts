export type BootstrapConfig = { mode: 'bootstrap'; host: '127.0.0.1'; port: number };

export function validateConfig(env: Record<string, string | undefined>, reservedPorts: number[] = []): BootstrapConfig {
  if (env.APP_MODE !== 'bootstrap') throw new Error('APP_MODE: debe ser bootstrap');
  if (env.HOST !== '127.0.0.1') throw new Error('HOST: debe ser loopback');
  if (!env.PORT || !/^[0-9]+$/.test(env.PORT)) throw new Error('PORT: debe ser entero');
  const port = Number(env.PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new Error('PORT: fuera de rango');
  if (reservedPorts.includes(port)) throw new Error('PORT: coincide con otro componente');
  return { mode: 'bootstrap', host: '127.0.0.1', port };
}
