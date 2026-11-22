import { describe, expect, it, vi } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';

const source = new InMemoryReviewedSourceCatalog([SYNTHETIC_SOURCE]);
const noTools = { search: vi.fn(), compare: vi.fn(), pharmacy: vi.fn() };

describe('conversación fundamentada F06.1', () => {
  it('cita ficha sintética y conserva referente en seguimiento', async () => {
    const service = new ConverseAssistant(new MockConversationProvider(), source, noTools, new InMemoryConversationStore(),
      () => new Date('2026-11-17T12:00:00.000Z'));
    const first = await service.execute({ consulta: '¿Qué indica la ficha de Producto Ficticio Alfa?' }, 'origen-a', 'corr-1');
    expect(first.estado).toBe('INFORMATIVA');
    expect(first.fuentes).toHaveLength(1);
    expect(first.fuentes[0].referencia).toBe(SYNTHETIC_SOURCE.reference);
    expect(first.respuesta).toContain(SYNTHETIC_SOURCE.educationalStatement);
    const followup = await service.execute({ consulta: '¿y sus advertencias?', conversacionId: first.conversacionId }, 'origen-a', 'corr-2');
    expect(followup.estado).toBe('INFORMATIVA');
    expect(followup.conversacionId).toBe(first.conversacionId);
    expect(noTools.search).not.toHaveBeenCalled();
  });
  it('se abstiene sin ficha y no inventa una afirmación', async () => {
    const service = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]), noTools,
      new InMemoryConversationStore(), () => new Date('2026-11-17T12:00:00.000Z'));
    const result = await service.execute({ consulta: '¿Qué indica la ficha de Producto Desconocido?' }, 'origen-a', 'corr-3');
    expect(result.estado).toBe('ABSTENCION');
    expect(result.fuentes).toEqual([]);
  });
  it('rechaza una dosis antes de proveedor o herramientas y no genera contexto', async () => {
    const provider = { classify: vi.fn() };
    const service = new ConverseAssistant(provider, source, noTools, new InMemoryConversationStore());
    const result = await service.execute({ consulta: '¿Qué dosis debo tomar?' }, 'origen-a', 'corr-4');
    expect(result.estado).toBe('CLINICA_RECHAZADA');
    expect(result.conversacionId).toBeUndefined();
    expect(provider.classify).not.toHaveBeenCalled();
    expect(noTools.search).not.toHaveBeenCalled();
  });
});
