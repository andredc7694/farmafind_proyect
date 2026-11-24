/**
 * F04.1: exportación CSV del historial. Sin datos personales del cliente. Neutraliza la inyección de fórmulas
 * (celdas que empiezan por = + - @ tabulación o retorno) y escapa comillas, comas y saltos de línea.
 */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  const lines = [header.map(csvCell).join(','), ...rows.map(row => row.map(csvCell).join(','))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
