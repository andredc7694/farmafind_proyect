export function validateFrontend(env) {
  if (env.VITE_APP_MODE !== 'bootstrap') throw new Error('VITE_APP_MODE: modo inválido o ausente');
  for (const key of Object.keys(env)) if (key.startsWith('VITE_') && key !== 'VITE_APP_MODE') throw new Error(`${key}: no permitido`);
  return { VITE_APP_MODE: 'bootstrap' };
}
