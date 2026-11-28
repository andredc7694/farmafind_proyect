import { describe, expect, it } from 'vitest';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';
import { assistant } from './fixtures/assistant-v2.js';

/** F06.2 · D-01 A: el servidor no guarda conversaciones; el seguimiento usa el contexto que reenvía la página. */
describe('contexto en la página (F06.2, antes almacén F06.1)', () => {
  const noTools = { search: async () => { throw new Error('No debe usarse F03'); }, suggestNames: async () => [] };
  const openers = ['Ficha de Producto Ficticio Alfa', '¿Qué indica la ficha de Producto Ficticio Alfa?',
    'Advertencias de Producto Ficticio Alfa', 'Producto Ficticio Alfa: ficha', 'Precauciones de Producto Ficticio Alfa'];
  const followups = ['¿y sus advertencias?', '¿qué indica la ficha?', '¿y la ficha?', 'sus advertencias', '¿qué dice la ficha?', '¿y sus precauciones?'];

  it('resuelve 30 diálogos ficticios con el referente que devuelve el propio servidor en «contexto» (30/30)', async () => {
    let successes = 0;
    for (const opener of openers) for (const followup of followups) {
      const { ask } = assistant(noTools, () => new Date('2026-11-17T12:00:00.000Z'), [SYNTHETIC_SOURCE]);
      const first = await ask(opener);
      const second = await ask(followup, first.contexto);
      if (first.estado === 'INFORMATIVA' && second.estado === 'INFORMATIVA' && second.fuentes[0]?.referencia === SYNTHETIC_SOURCE.reference) successes++;
    }
    expect(successes).toBe(30);
  });

  it('sin contexto (recarga de la página) el seguimiento no recuerda nada', async () => {
    const { ask } = assistant(noTools, () => new Date('2026-11-17T12:00:00.000Z'), [SYNTHETIC_SOURCE]);
    expect((await ask('¿qué dice la ficha?')).estado).toBe('ABSTENCION');
  });

  it('no hay estado en el servidor: el servicio no retiene lo preguntado', async () => {
    const { ask, service } = assistant(noTools, () => new Date('2026-11-17T12:00:00.000Z'), [SYNTHETIC_SOURCE]);
    await ask('Ficha de Producto Ficticio Alfa');
    expect(Object.keys(service).sort()).toEqual(['now', 'provider', 'sources', 'tools']);
  });
});
