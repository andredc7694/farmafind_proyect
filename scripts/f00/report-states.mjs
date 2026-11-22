const states = new Set(['pending', 'passed', 'failed']);

export function aggregate(values) {
  if (!values.every(value => states.has(value))) throw new Error('Estado de control inválido');
  if (values.includes('failed')) return 'failed';
  if (!values.length || values.includes('pending')) return 'pending';
  return 'passed';
}

export function executionStates(controls, scope) {
  if (!['local', 'complete'].includes(scope)) throw new Error('Scope inválido');
  const local = aggregate(controls.filter(c => c.group === 'local').map(c => c.state));
  const overall = local === 'failed' ? 'failed'
    : scope === 'local' ? 'pending'
    : aggregate(controls.filter(c => c.group === 'complete').map(c => c.state).concat(local, controls.some(c => c.id === 'playwright-ui' && c.state === 'passed') ? 'passed' : 'pending'));
  return { local, overall, acceptance: 'pending' };
}
