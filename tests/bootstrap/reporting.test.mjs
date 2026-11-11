import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { aggregate, executionStates } from '../../scripts/f00/report-states.mjs';
import { createReport, writeReport } from '../../scripts/f00/report.mjs';
import { createComponent, transition } from '../../scripts/f00/component.mjs';
import { sourceManifest } from '../../scripts/f00/source-manifest.mjs';
import { preparation } from '../../scripts/f00/preparation.mjs';
const resultFixtures = JSON.parse(readFileSync(new URL('../fixtures/reports/results.json', import.meta.url), 'utf8'));

describe('reportes técnicos, sin evidencia de aceptación ficticia', () => {
  it('conserva un fallo aunque otro control o UI estén pendientes', () => {
    expect(aggregate(['failed', 'pending'])).toBe('failed');
    expect(executionStates([{ state: 'failed', group: 'local' }], 'local'))
      .toEqual({ local: 'failed', overall: 'failed', acceptance: 'pending' });
  });
  it('éxito local nunca acredita UI ni aceptación del par', () => {
    expect(executionStates([{ state: 'passed', group: 'local' }], 'local'))
      .toEqual(resultFixtures.localSuccess);
    expect(executionStates([{ state: 'passed', group: 'local' }], 'complete').acceptance).toBe('pending');
  });
  it('ausencia, interrupción y valores inválidos no producen verde', () => {
    expect(aggregate([])).toBe('pending');
    expect(aggregate(['passed', 'pending'])).toBe('pending');
    expect(() => aggregate(['skipped'])).toThrow();
    expect(executionStates([{ state: 'failed', group: 'local', id: 'cleanup' }], 'local').local).toBe('failed');
  });
  it('una ejecución completa sin comprobación UI no obtiene overall passed', () => {
    expect(executionStates([{ state: 'passed', group: 'local' }], 'complete').overall).toBe('pending');
  });
  it('rechaza componentes o puertos repetidos dentro de una preparación', () => {
    const first = createComponent({ componentId: 'farmafind-api', role: 'núcleo modular', host: '127.0.0.1', port: 3000, mode: 'bootstrap' });
    expect(() => createComponent({ componentId: 'farmafind-api', role: 'núcleo modular', host: '127.0.0.1', port: 3002, mode: 'bootstrap' }, [first])).toThrow();
    expect(() => createComponent({ componentId: 'farmafind-notifications', role: 'proceso independiente', host: '127.0.0.1', port: 3000, mode: 'bootstrap' }, [first])).toThrow();
  });
  it('distingue lifecycle de comprobación observable y valida identidad/puerto', () => {
    const c = createComponent({ componentId: 'farmafind-api', role: 'núcleo modular', host: '127.0.0.1', port: 3000, mode: 'bootstrap' });
    transition(c, 'starting'); transition(c, 'running');
    expect(c.observableCheck).toBe('pending');
    expect(() => transition(c, 'not_started')).toThrow();
    expect(() => createComponent({ ...c, port: 0 })).toThrow();
    expect(() => createComponent({ ...c, componentId: 'business' })).toThrow();
  });
  it('preparaciones requieren A/B y no inventan identidades', () => {
    expect(preparation('A', { hash: 'fixture' }).preparationId).toBe('A');
    expect(() => preparation('C', {})).toThrow();
  });
  it('rechaza evidencia incompleta y acceptance individual passed', () => {
    expect(() => createReport({ preparationId: 'C' })).toThrow();
    const r = createReport({ preparationId: 'A', scope: 'local', source: { hash: 'fixture' } });
    r.acceptance = 'passed';
    expect(() => writeReport(r, 'unused')).toThrow();
  });
  it('hashes deterministas excluyen salidas y configuración privada', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'farmafind hash '));
    try {
      mkdirSync(path.join(dir, 'frontend'));
      writeFileSync(path.join(dir, 'frontend', 'example.js'), 'export const value = 1;');
      const a = sourceManifest(dir);
      writeFileSync(path.join(dir, 'frontend', '.env.local'), 'SECRET=fixture-only');
      mkdirSync(path.join(dir, 'frontend', 'dist'));
      writeFileSync(path.join(dir, 'frontend', 'dist', 'output.js'), 'generated');
      mkdirSync(path.join(dir, 'artifacts'));
      writeFileSync(path.join(dir, 'artifacts', 'evidence.json'), '{"result":"fixture"}');
      expect(sourceManifest(dir).hash).toBe(a.hash);
      writeFileSync(path.join(dir, 'frontend', 'example.js'), 'export const value = 2;');
      expect(sourceManifest(dir).hash).not.toBe(a.hash);
    } finally {
      if (!dir.startsWith(path.join(tmpdir(), 'farmafind hash '))) throw new Error('Unsafe cleanup target');
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('no sobrescribe un reporte previo', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'farmafind report '));
    try {
      const r = createReport({ preparationId: 'A', scope: 'local', source: { hash: 'fixture' } });
      writeReport(r, dir);
      expect(() => writeReport(r, dir)).toThrow();
    } finally {
      if (!dir.startsWith(path.join(tmpdir(), 'farmafind report '))) throw new Error('Unsafe cleanup target');
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
