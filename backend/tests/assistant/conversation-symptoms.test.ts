import { describe, expect, it } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { SYNTHETIC_SOURCE } from './fixtures/conversation-fixtures.js';

const tools = { search: async () => { throw Error('F03 no requerido'); },
  compare: async () => { throw Error('F03 no requerido'); }, pharmacy: async () => null };
const now = () => new Date('2026-11-17T12:00:00.000Z');
function service(sources) { return new ConverseAssistant(new MockConversationProvider(),
  new InMemoryReviewedSourceCatalog(sources), tools, now); }

describe('molestias educativas TEST F06.1', () => {
  it('solo cita contenido ficticio con fuente completa, vigente y aprobada para TEST', async () => {
    const result = await service([SYNTHETIC_SOURCE]).execute(
      { consulta: 'Clases para molestia ficticia' }, 'corr');
    expect(result.estado).toBe('INFORMATIVA');
    expect(result.respuesta).toBe(SYNTHETIC_SOURCE.educationalStatement);
    expect(result.fuentes[0].referencia).toBe(SYNTHETIC_SOURCE.reference);
  });
  it.each([
    [], [{ ...SYNTHETIC_SOURCE, reusePermission: '' }],
    [{ ...SYNTHETIC_SOURCE, professionalReviewer: '' }],
    [{ ...SYNTHETIC_SOURCE, validUntil: '2026-01-01T00:00:00.000Z' }],
    [SYNTHETIC_SOURCE, { ...SYNTHETIC_SOURCE, reference: 'test://otra', educationalStatement: 'Contradictoria TEST' }],
  ].map(sources => [sources]))('se abstiene sin permiso, revisión, vigencia o ante contradicción', async sources => {
    const result = await service(sources).execute({ consulta: 'Clases para molestia ficticia' }, 'corr');
    expect(result).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
  });
  it('rechaza la selección de tratamiento personal aun con ficha TEST', async () => {
    const result = await service([SYNTHETIC_SOURCE]).execute(
      { consulta: '¿Qué dosis debo tomar para mi molestia ficticia?' }, 'corr');
    expect(result.estado).toBe('CLINICA_RECHAZADA');
    expect(result.fuentes).toEqual([]);
  });
});
