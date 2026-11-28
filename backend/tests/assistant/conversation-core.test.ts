import { describe, expect, it, vi } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';

const source = new InMemoryReviewedSourceCatalog([SYNTHETIC_SOURCE]);
const noTools = { search: vi.fn(), suggestNames: vi.fn() };

describe('conversación fundamentada F06.1 (sin almacén, F06.2)', () => {
  it('cita ficha sintética y conserva el referente con el contexto devuelto', async () => {
    const service = new ConverseAssistant(new MockConversationProvider(), source, noTools, () => new Date('2026-11-17T12:00:00.000Z'));
    const first = await service.execute({ consulta: '¿Qué indica la ficha de Producto Ficticio Alfa?', contexto: {} }, 'corr-1');
    expect(first).toMatchObject({ version: '2.0', estado: 'INFORMATIVA', contexto: { medicamento: 'Producto Ficticio Alfa' } });
    expect(first.fuentes[0].referencia).toBe(SYNTHETIC_SOURCE.reference);
    expect(first.respuesta).toContain(SYNTHETIC_SOURCE.educationalStatement);
    const followup = await service.execute({ consulta: '¿y sus advertencias?', contexto: first.contexto }, 'corr-2');
    expect(followup.estado).toBe('INFORMATIVA');
    expect(followup.respuesta).toBe(SYNTHETIC_SOURCE.educationalWarning);
    expect(noTools.search).not.toHaveBeenCalled();
  });
  it('se abstiene sin ficha y no inventa una afirmación', async () => {
    const service = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]), noTools);
    const result = await service.execute({ consulta: '¿Qué indica la ficha de Producto Desconocido?', contexto: {} }, 'corr-3');
    expect(result).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
  });
  it('rechaza una dosis antes de proveedor o herramientas y devuelve contexto vacío', async () => {
    const provider = { classify: vi.fn() };
    const service = new ConverseAssistant(provider, source, noTools);
    const result = await service.execute({ consulta: '¿Qué dosis debo tomar?', contexto: { intencion: 'PRECIO', medicamento: 'paracetamol' } }, 'corr-4');
    expect(result).toMatchObject({ estado: 'CLINICA_RECHAZADA', contexto: {} });
    expect(provider.classify).not.toHaveBeenCalled();
    expect(noTools.search).not.toHaveBeenCalled();
  });
});
