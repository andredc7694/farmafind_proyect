import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { comparePreparations } from '../../scripts/f00/compare-preparations.mjs';
const fixture = JSON.parse(readFileSync(new URL('../fixtures/reports/pairs/base.json', import.meta.url), 'utf8'));

function run(id, overrides = {}) {
  return {
    runId: `F00-${id}-fixture`, preparationId: id, scope: 'complete',
    source: { hash: fixture.sourceHash, lockfileHash: fixture.lockfileHash },
    workingDirectory: fixture.workingDirectories[id], local: 'passed', overall: 'passed', acceptance: 'pending',
    requirementIds: ['F00-FR-001', 'F00-SC-001', 'RUBRICA-01'],
    commands: [{ command: 'verify:bootstrap', directory: `copy-${id}`, started: 'fixture', finished: 'fixture', exitCode: 0 }],
    versions: { node: 'fixture', npm: 'fixture', browser: 'fixture', sourceHash: 'same-revision', lockfileHash: 'same-lock' },
    expected: ['UI y HTTP'], actual: [{ component: 'frontend', result: 'fixture', durationMs: 1 }], errors: 'none',
    artifacts: [{ kind: 'browser-capture', state: 'recorded', path: `captures/${id}.png` }],
    cleanup: 'passed', controls: [{ id: 'playwright-ui', group: 'complete', state: 'passed' }],
    ...overrides,
  };
}

describe('comparador de preparaciones sintéticas', () => {
  it('sin par o con solo controles locales deja acceptance pending', () => {
    expect(comparePreparations(run('A'), null).acceptance).toBe('pending');
    expect(comparePreparations(run('A', { scope: 'local' }), run('B')).acceptance).toBe('pending');
  });
  it('rechaza revisión distinta o independencia no acreditada', () => {
    expect(comparePreparations(run('A'), run('B', { source: { hash: 'other', lockfileHash: 'same-lock' } })).acceptance).toBe('pending');
    expect(comparePreparations(run('A'), run('B', { workingDirectory: 'copy-A' })).acceptance).toBe('pending');
  });
  it('un fallo real prevalece sobre un control pendiente de un par comparable', () => {
    expect(comparePreparations(run('A', { overall: 'failed' }), run('B', { overall: 'pending' })).acceptance).toBe('failed');
  });
  it('evidencia incompleta deja pending y par completo pasa sin mutar reportes', () => {
    const a = run('A'); const b = run('B');
    expect(comparePreparations(a, run('B', { artifacts: [] })).acceptance).toBe('pending');
    expect(comparePreparations(a, b).acceptance).toBe('passed');
    expect(a.acceptance).toBe('pending'); expect(b.acceptance).toBe('pending');
  });
});
