/**
 * F06.2 · D-03 A: «¿Quisiste decir…?» con distancia de edición propia (Damerau-Levenshtein con transposición
 * adyacente), sin librerías ni servicios. Se corta en cuanto supera el máximo.
 */
export function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows: number[][] = [Array.from({ length: b.length + 1 }, (_, j) => j)];
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(rows[i - 1][j] + 1, row[j - 1] + 1, rows[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, rows[i - 2][j - 2] + 1);
      row.push(value);
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
    rows.push(row);
  }
  return Math.min(rows[a.length][b.length], max + 1);
}

/** Máximo permitido: 2 para palabras de 6 letras o más; 1 para 4 o 5 letras; ninguno con menos de 4. */
export function allowedDistance(word: string): number {
  if (word.length < 4) return 0;
  return word.length >= 6 ? 2 : 1;
}

/** El candidato más cercano y único dentro del máximo; null si no hay o si empatan dos distintos. */
export function closestWord(word: string, candidates: Iterable<string>): string | null {
  const max = allowedDistance(word);
  if (max === 0) return null;
  let best: string | null = null; let bestDistance = max + 1; let tie = false;
  for (const candidate of new Set(candidates)) {
    if (candidate === word || candidate.length < 4) continue;
    const distance = editDistance(word, candidate, max);
    if (distance < bestDistance) { best = candidate; bestDistance = distance; tie = false; }
    else if (distance === bestDistance && distance <= max) tie = true;
  }
  return bestDistance <= max && !tie ? best : null;
}
