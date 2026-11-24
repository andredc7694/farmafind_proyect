/** F08.1: razón de contraste WCAG 2.x entre dos colores sRGB (#rgb o #rrggbb). Sin dependencias. */
const channel = value => {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function parseHex(color) {
  const text = String(color).trim().toLowerCase();
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);
  if (short) return short.slice(1).map(part => parseInt(part + part, 16));
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(text);
  if (long) return long.slice(1).map(part => parseInt(part, 16));
  throw new Error(`Color no admitido: ${color}`);
}

export function luminance(color) {
  const [r, g, b] = parseHex(color);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(foreground, background) {
  const a = luminance(foreground); const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/** Pares (primer plano, fondo, mínimo) que la interfaz usa: texto normal 4.5:1; controles y foco 3:1. */
export const requiredPairs = [
  ['ink', 'canvas', 4.5], ['ink', 'surface', 4.5], ['ink', 'surface-soft', 4.5], ['ink', 'tint', 4.5], ['ink', 'tint-2', 4.5],
  ['ink', 'tint-3', 4.5], ['ink', 'tint-4', 4.5], ['ink', 'mint', 4.5], ['ink', 'selection', 4.5],
  ['ink-muted', 'canvas', 4.5], ['ink-muted', 'surface', 4.5], ['ink-muted', 'surface-soft', 4.5], ['ink-muted', 'tint-4', 4.5],
  ['petrol', 'surface', 4.5], ['emerald', 'surface', 3], ['emerald-dark', 'surface', 4.5], ['emerald-dark', 'mint', 4.5],
  ['on-accent', 'emerald', 4.5], ['danger', 'surface', 4.5], ['danger', 'canvas', 4.5],
  ['control-border', 'surface', 3], ['line-strong', 'surface', 3], ['focus', 'surface', 3], ['focus', 'canvas', 3],
];
