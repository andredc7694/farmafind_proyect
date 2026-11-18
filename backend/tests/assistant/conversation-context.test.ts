import { describe, expect, it } from 'vitest';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { ConversationRequestError } from '../../src/modules/asistente-ia/domain/conversation-contract.js';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';

describe('contexto efímero F06.1', () => {
  it('conserva solo referente no clínico durante seis turnos y expira a los 15 minutos', () => {
    let now = 1_000;
    const store = new InMemoryConversationStore(() => now);
    let ctx = store.create('origen-a', 'Producto Ficticio Alfa');
    expect(ctx).toMatchObject({ referent: 'Producto Ficticio Alfa', turns: 1 });
    expect(JSON.stringify(store)).not.toContain('origen-a');
    for (let n = 2; n <= 6; n++) ctx = store.advance('origen-a', ctx.id, null);
    expect(ctx.turns).toBe(6);
    expect(() => store.get('origen-a', ctx.id)).toThrow(ConversationRequestError);
    now += 15 * 60_000;
    expect(() => store.get('origen-a', ctx.id)).toThrow(/venció|disponible/);
  });
  it('vincula identificador al origen y elimina sin revelar si existe', () => {
    const store = new InMemoryConversationStore();
    const ctx = store.create('origen-a', 'Producto Ficticio Alfa');
    expect(() => store.get('origen-b', ctx.id)).toThrow(ConversationRequestError);
    store.discard('origen-b', ctx.id);
    expect(store.get('origen-a', ctx.id).referent).toBe('Producto Ficticio Alfa');
    store.discard('origen-a', ctx.id);
    store.discard('origen-a', ctx.id);
    expect(() => store.get('origen-a', ctx.id)).toThrow(ConversationRequestError);
  });
  it('acota capacidad y no reactiva conversaciones desalojadas', () => {
    const store = new InMemoryConversationStore(() => 1000, 900_000, 6, 1);
    const first = store.create('a', 'A');
    const second = store.create('a', 'B');
    expect(() => store.get('a', first.id)).toThrow(ConversationRequestError);
    expect(store.get('a', second.id).referent).toBe('B');
  });
  it('acota contextos por origen sin desalojar la conversación de otro origen', () => {
    const store = new InMemoryConversationStore(() => 1000, 900_000, 6, 10, 2);
    const other = store.create('origen-b', 'B');
    const first = store.create('origen-a', 'A1');
    store.create('origen-a', 'A2');
    store.create('origen-a', 'A3');
    expect(() => store.get('origen-a', first.id)).toThrow(ConversationRequestError);
    expect(store.get('origen-b', other.id).referent).toBe('B');
  });
});

const openers = [
  'Ficha de Producto Ficticio Alfa', '¿Qué indica la ficha de Producto Ficticio Alfa?',
  'Advertencias de Producto Ficticio Alfa', 'Producto Ficticio Alfa: ficha',
  'Precauciones de Producto Ficticio Alfa',
];
const followups = ['¿y sus advertencias?', '¿qué indica la ficha?', '¿y la ficha?',
  'sus advertencias', '¿qué dice la ficha?', '¿y sus precauciones?'];

it('resuelve 30 diálogos ficticios independientes con referente correcto (30/30)', async () => {
  const tools = { search: async () => { throw new Error('No debe usarse F03'); },
    compare: async () => { throw new Error('No debe usarse F03'); },
    pharmacy: async () => { throw new Error('No debe usarse F03'); } };
  let successes = 0;
  for (const opener of openers) for (const followup of followups) {
    const service = new ConverseAssistant(new MockConversationProvider(),
      new InMemoryReviewedSourceCatalog([SYNTHETIC_SOURCE]), tools,
      new InMemoryConversationStore(), () => new Date('2026-11-17T12:00:00.000Z'));
    const first = await service.execute({ consulta: opener }, 'TEST', 'corr-1');
    const second = await service.execute({ consulta: followup, conversacionId: first.conversacionId }, 'TEST', 'corr-2');
    if (first.estado === 'INFORMATIVA' && second.estado === 'INFORMATIVA' &&
        second.fuentes[0]?.referencia === SYNTHETIC_SOURCE.reference) successes++;
  }
  expect(successes).toBeGreaterThanOrEqual(27);
  expect(successes).toBe(30);
});
