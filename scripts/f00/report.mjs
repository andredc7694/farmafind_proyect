import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { executionStates } from './report-states.mjs';

export function createReport({ preparationId, scope, source, controls = [], requirementIds = [] }) {
  if (!['A', 'B'].includes(preparationId) || !['local', 'complete'].includes(scope) || !source?.hash) throw new Error('Datos de reporte incompletos');
  return { runId: `F00-${preparationId}-${new Date().toISOString().replaceAll(':', '-')}`, preparationId, scope, source, requirementIds, controls, commands: [], versions: { node: process.version, sourceHash: source.hash, lockfileHash: source.lockfileHash ?? null, browser: 'pending' }, expected: [], actual: [], errors: [], artifacts: [{ kind: 'browser-capture', state: 'pending' }], cleanup: 'pending', ...executionStates(controls, scope) };
}

export function redactReport(report, privateValues = []) {
  const scrub = value => {
    if (typeof value === 'string') {
      let result = value.replace(/[A-Za-z]:[\\/]Users[\\/][^\\/\s]+/gi, '<ruta-usuario>');
      for (const privateValue of privateValues.filter(Boolean)) result = result.replaceAll(privateValue, '<redactado>');
      return result;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, scrub(item)]));
    return value;
  };
  return scrub(report);
}

export function writeReport(report, directory, privateValues = []) {
  if (report.acceptance !== 'pending' || !['pending', 'passed', 'failed'].includes(report.local) || !['pending', 'passed', 'failed'].includes(report.overall) || (report.scope === 'local' && report.overall === 'passed')) throw new Error('Estado de reporte inválido');
  mkdirSync(directory, { recursive: true });
  const target = path.join(directory, `${report.runId}.json`);
  writeFileSync(target, JSON.stringify(redactReport({ ...report, errors: report.errors.length ? report.errors : 'none' }, privateValues), null, 2) + '\n', { flag: 'wx' });
  return target;
}
