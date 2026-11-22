import { it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evidenceIssues } from '../../scripts/f00/compare-preparations.mjs';
import { sourceManifest } from '../../scripts/f00/source-manifest.mjs';
import { redactReport } from '../../scripts/f00/report.mjs';

const valid = {
  runId: 'fixture', preparationId: 'A', scope: 'complete', source: { hash: 'source', lockfileHash: 'lock' },
  requirementIds: ['F00-FR-001', 'F00-SC-001', 'RUBRICA-01'],
  commands: [{ command: 'check', directory: 'copy-A', started: 'fixture', finished: 'fixture', exitCode: 0 }],
  versions: { node: 'fixture', npm: 'fixture', browser: 'fixture', sourceHash: 'source', lockfileHash: 'lock' },
  expected: ['expected'], actual: [{ component: 'frontend', result: 'fixture', durationMs: 1 }],
  errors: 'none', artifacts: [{ kind: 'browser-capture', state: 'recorded', path: 'captures/a.png' }], cleanup: 'passed',
  local: 'passed', overall: 'passed', acceptance: 'pending', controls: [{ id: 'playwright-ui', state: 'passed' }],
};

it('omitir comandos, versiones, expectativas, obtenidos, errores o limpieza impide passed', () => {
  for (const key of ['commands', 'versions', 'expected', 'actual', 'errors', 'cleanup']) {
    const copy = structuredClone(valid); delete copy[key];
    expect(evidenceIssues(copy).length, key).toBeGreaterThan(0);
  }
});
it('hashes o estados inconsistentes y falta de trazas FR/SC/rúbrica impiden passed', () => {
  expect(evidenceIssues({ ...valid, versions: { ...valid.versions, sourceHash: 'other' } }).length).toBeGreaterThan(0);
  expect(evidenceIssues({ ...valid, overall: 'green' }).length).toBeGreaterThan(0);
  expect(evidenceIssues({ ...valid, requirementIds: [] }).length).toBeGreaterThan(0);
});
it('salidas y configuración privada no alteran hash de fuente; marcador se redacta', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'farmafind evidence '));
  try {
    mkdirSync(path.join(root, 'frontend'));
    writeFileSync(path.join(root, 'frontend', 'file.jsx'), 'fixture');
    const before = sourceManifest(root).hash;
    writeFileSync(path.join(root, 'frontend', '.env.local'), 'PRIVATE_FIXTURE_VALUE');
    mkdirSync(path.join(root, 'artifacts'));
    writeFileSync(path.join(root, 'artifacts', 'result.json'), '{}');
    expect(sourceManifest(root).hash).toBe(before);
    expect(JSON.stringify(redactReport({ errors: ['PRIVATE_FIXTURE_VALUE'] }, ['PRIVATE_FIXTURE_VALUE']))).not.toContain('PRIVATE_FIXTURE_VALUE');
  } finally {
    if (!root.startsWith(path.join(tmpdir(), 'farmafind evidence '))) throw new Error('Unsafe cleanup target');
    rmSync(root, { recursive: true, force: true });
  }
});
