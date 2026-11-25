import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrastRatio, requiredPairs } from '../../src/design/contrast.js';

const css = readFileSync(new URL('../../src/design/tokens.css', import.meta.url), 'utf8');
const block = (start) => {
  const from = css.indexOf(start); if (from < 0) throw new Error(`Bloque ausente: ${start}`);
  const open = css.indexOf('{', from); let depth = 0; let end = open;
  for (; end < css.length; end++) { if (css[end] === '{') depth++; if (css[end] === '}' && --depth === 0) break; }
  return css.slice(open + 1, end);
};
const tokens = text => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map(match => [match[1], match[2]]));

const light = tokens(block(':root {'));
const dark = tokens(block(":root[data-theme='dark']"));
const system = tokens(block(':root:not([data-theme=\'light\'])'));

describe('F08.1 contraste de los temas (WCAG AA) calculado sobre los tokens reales', () => {
  it('el tema oscuro y el modo sistema definen exactamente los mismos valores', () => {
    expect(Object.keys(dark).length).toBeGreaterThanOrEqual(20);
    expect(system).toEqual(dark);
  });

  it('el tema oscuro redefine todos los tokens de color del claro', () => {
    for (const name of Object.keys(light)) if (!['shadow'].includes(name)) expect(dark, name).toHaveProperty(name);
  });

  for (const [themeName, theme] of [['claro', light], ['oscuro', dark]]) {
    it(`cada par requerido cumple su mínimo en el tema ${themeName}`, () => {
      const failures = requiredPairs
        .map(([fg, bg, minimum]) => ({ fg, bg, minimum, ratio: contrastRatio(theme[fg], theme[bg]) }))
        .filter(item => item.ratio < item.minimum)
        .map(item => `${item.fg} sobre ${item.bg}: ${item.ratio.toFixed(2)} < ${item.minimum}`);
      expect(failures).toEqual([]);
    });
  }

  it('la función de contraste coincide con valores conocidos', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
    expect(contrastRatio('#fff', '#fff')).toBeCloseTo(1, 5);
    expect(() => contrastRatio('rojo', '#fff')).toThrow();
  });
});
