/**
 * F08.1: tema claro / oscuro / sistema. Con sesión se guarda en el perfil (campo `tema` de F01.1); sin sesión, solo en el
 * navegador (sin datos personales). Todo acceso a almacenamiento está protegido: si falla, se usa el tema del sistema.
 */
export const THEME_VALUES = ['SISTEMA', 'CLARO', 'OSCURO'];
export const THEME_LABELS = { SISTEMA: 'Según el dispositivo', CLARO: 'Claro', OSCURO: 'Oscuro' };
const STORAGE_KEY = 'ff-theme';
const attribute = { SISTEMA: 'system', CLARO: 'light', OSCURO: 'dark' };

export const isTheme = value => THEME_VALUES.includes(value);

export function applyTheme(value, root = typeof document === 'undefined' ? null : document.documentElement) {
  const theme = isTheme(value) ? value : 'SISTEMA';
  if (root) root.setAttribute('data-theme', attribute[theme]);
  return theme;
}

export function readStoredTheme(storage = safeStorage()) {
  try { const value = storage?.getItem(STORAGE_KEY); return isTheme(value) ? value : 'SISTEMA'; } catch { return 'SISTEMA'; }
}

export function storeTheme(value, storage = safeStorage()) {
  if (!isTheme(value)) return false;
  try { storage?.setItem(STORAGE_KEY, value); return true; } catch { return false; }
}

function safeStorage() { try { return typeof window === 'undefined' ? null : window.localStorage; } catch { return null; } }

/** Aplica el tema guardado en el navegador lo antes posible (antes de pintar la aplicación). */
export function initTheme(storage, root) { return applyTheme(readStoredTheme(storage), root); }

/**
 * Cambia el tema: lo aplica al instante, lo recuerda en el navegador y, si hay sesión, lo guarda en el perfil.
 * El fallo del perfil no deshace el cambio local (el tema es una conveniencia, no un dato crítico).
 */
export async function chooseTheme(value, { signedIn = false, profile = null, storage, root } = {}) {
  const theme = applyTheme(value, root);
  storeTheme(theme, storage);
  if (signedIn && profile) { try { await profile.update({ theme }); } catch { /* se conserva el local */ } }
  return theme;
}

/** Al iniciar sesión el perfil manda: se aplica y se refleja en el navegador. */
export function syncThemeFromProfile(profileTheme, { storage, root } = {}) {
  if (!isTheme(profileTheme)) return readStoredTheme(storage);
  storeTheme(profileTheme, storage); return applyTheme(profileTheme, root);
}
