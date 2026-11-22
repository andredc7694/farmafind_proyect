/** Keep the existing technical TEST state untouched while preparing a fresh manual DEMO DB. */
export function localStateName(name, slot = process.env.F025_DEMO_SLOT) {
  if (slot !== undefined && slot !== '' && slot !== 'manual')
    throw new Error('F02.5: solo se admite el slot manual de demostración TEST');
  if (!/^(state|demo|credentials|approval|catalog-fixture)\.local\.json$/.test(name))
    throw new Error('F02.5: nombre de estado local no permitido');
  return slot === 'manual' ? name.replace('.local.json', '.manual.local.json') : name;
}
