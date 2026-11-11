import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const validStates = new Set(['pending', 'passed', 'failed']);
export function evidenceIssues(run) {
  const issues = [];
  if (!run || !['A', 'B'].includes(run.preparationId) || !['local', 'complete'].includes(run.scope)) issues.push('identidad o scope');
  if (!run?.source?.hash || !run.source.lockfileHash) issues.push('revisión/lockfile');
  if (!Array.isArray(run?.requirementIds) || !run.requirementIds.some(id => id.startsWith('F00-FR-')) || !run.requirementIds.some(id => id.startsWith('F00-SC-')) || !run.requirementIds.some(id => id.startsWith('RUBRICA-'))) issues.push('trazabilidad FR/SC/rúbrica');
  if (!Array.isArray(run?.commands) || !run.commands.length || run.commands.some(c => !c.command || !c.directory || !c.started || !c.finished || !Number.isInteger(c.exitCode))) issues.push('comandos');
  if (!run?.versions?.node || !run.versions.npm || !run.versions.browser || (run.scope === 'complete' && run.versions.browser === 'pending') || run.versions.sourceHash !== run?.source?.hash || run.versions.lockfileHash !== run?.source?.lockfileHash) issues.push('versiones/hashes');
  if (!Array.isArray(run?.expected) || !run.expected.length) issues.push('expectativas');
  if (!Array.isArray(run?.actual) || !run.actual.length || run.actual.some(item => !item.component || !item.result || !Number.isFinite(item.durationMs))) issues.push('resultados');
  if (run?.errors !== 'none' && (!Array.isArray(run?.errors) || !run.errors.length)) issues.push('errores/none');
  if (!Array.isArray(run?.artifacts) || !run.artifacts.some(a => a.kind === 'browser-capture' && a.state === 'recorded' && a.path)) issues.push('captura UI');
  if (run?.cleanup !== 'passed') issues.push('limpieza');
  if (![run?.local, run?.overall, run?.acceptance].every(s => validStates.has(s)) || run?.acceptance !== 'pending') issues.push('estados');
  if (!Array.isArray(run?.controls) || !run.controls.some(c => c.id === 'playwright-ui' && c.state === 'passed')) issues.push('control UI');
  return issues;
}

export function comparePreparations(a, b) {
  const base = { runIds: [a?.runId ?? null, b?.runId ?? null], acceptance: 'pending', reasons: [] };
  if (!a || !b || a.preparationId !== 'A' || b.preparationId !== 'B' || a.scope !== 'complete' || b.scope !== 'complete' || a.runId === b.runId || !a.workingDirectory || !b.workingDirectory || a.workingDirectory === b.workingDirectory || a.source?.hash !== b.source?.hash || a.source?.lockfileHash !== b.source?.lockfileHash) {
    base.reasons.push('Par completo, comparable e independiente ausente'); return base;
  }
  base.source = { hash: a.source.hash, lockfileHash: a.source.lockfileHash };
  base.workingDirectories = [a.workingDirectory, b.workingDirectory];
  if ([a.overall, b.overall].includes('failed')) { base.acceptance = 'failed'; base.reasons.push('Fallo observado en una preparación'); return base; }
  const issues = [...evidenceIssues(a).map(x => `A: ${x}`), ...evidenceIssues(b).map(x => `B: ${x}`)];
  if (a.overall !== 'passed' || b.overall !== 'passed' || issues.length) { base.reasons.push(...issues, 'Controles completos pendientes'); return base; }
  base.acceptance = 'passed'; return base;
}

export function writeComparison(summary, directory) {
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, 'acceptance.json');
  writeFileSync(target, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
  return target;
}
