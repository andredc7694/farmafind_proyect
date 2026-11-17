export function validateFrontend(env) {
  if (env.VITE_APP_MODE !== 'bootstrap') throw new Error('VITE_APP_MODE: modo inválido o ausente');
  const allowed = new Set(['VITE_APP_MODE', 'VITE_PUBLIC_SEARCH_PATH']);
  for (const key of Object.keys(env)) if (key.startsWith('VITE_') && !allowed.has(key)) throw new Error(`${key}: no permitido`);
  if (env.VITE_PUBLIC_SEARCH_PATH !== undefined && env.VITE_PUBLIC_SEARCH_PATH !== '/api/v1/busquedas') {
    throw new Error('VITE_PUBLIC_SEARCH_PATH: ruta pública inválida');
  }
  return {
    VITE_APP_MODE: 'bootstrap',
    ...(env.VITE_PUBLIC_SEARCH_PATH === undefined ? {} : { VITE_PUBLIC_SEARCH_PATH: '/api/v1/busquedas' }),
  };
}
