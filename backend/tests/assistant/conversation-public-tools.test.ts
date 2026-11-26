import { describe, expect, it, vi } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { PUBLIC_NOTICE } from '../../src/modules/busqueda/contracts/public-search.js';
import { F03ConversationPublicTools } from '../../src/modules/asistente-ia/infrastructure/conversation-public-tools.js';

const offer = { medicamento: { id: 'med-test', nombreComercial: 'Producto Ficticio Alfa',
  principioActivo: 'Compuesto ficticio', concentracion: 'TEST', presentacion: 'TEST', clasificacion: 'TEST' },
  farmacia: { id: 'farm-test', nombre: 'Farmacia Ficticia Alfa', direccion: 'TEST' },
  precioReferencialCentavos: 1234, disponibilidadReferencial: 'DISPONIBLE' as const,
  ultimaRevision: '2026-11-17T12:00:00.000Z', distanciaKm: null };
function response(ofertas = [offer]) { return { consulta: 'producto ficticio alfa', ofertas,
  paginacion: { pagina: 1, tamano: 20, total: ofertas.length, totalPaginas: 1 }, aviso: PUBLIC_NOTICE }; }

describe('frontera pública F03/F06.1', () => {
  it('el adaptador delega exclusivamente métodos públicos de F03', async () => {
    const gateway = { search: vi.fn().mockResolvedValue(response()),
      compare: vi.fn().mockResolvedValue(response()), pharmacy: vi.fn().mockResolvedValue(null) };
    const tools = new F03ConversationPublicTools(gateway);
    expect(await tools.search('TEST')).toEqual(response());
    expect(await tools.compare('TEST')).toEqual(response());
    expect(await tools.pharmacy('TEST')).toBeNull();
    expect(gateway.search).toHaveBeenCalledWith('TEST');
    expect(gateway.compare).toHaveBeenCalledWith('TEST');
    expect(gateway.pharmacy).toHaveBeenCalledWith('TEST');
  });
  it('construye precio, farmacia y fecha solo desde el DTO público de la misma consulta', async () => {
    const tools = { search: vi.fn().mockResolvedValue(response()), compare: vi.fn(), pharmacy: vi.fn() };
    const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      tools, new InMemoryConversationStore());
    const result = await assistant.execute({ consulta: 'busca Producto Ficticio Alfa' }, 'TEST', 'corr');
    expect(tools.search).toHaveBeenCalledOnce();
    expect(result.estado).toBe('BUSQUEDA_PUBLICA');
    expect(result.respuesta).toContain('S/ 12.34');
    expect(result.respuesta).toContain('Farmacia Ficticia Alfa');
    expect(result.respuesta).toContain('17/11/2026');
    expect(result.respuesta).toContain('disponibilidad referencial');
    expect(result.fuentes).toHaveLength(1);
    expect(tools.pharmacy).not.toHaveBeenCalled();
  });
  it('no inventa ofertas ni precios cuando F03 devuelve cero resultados', async () => {
    const tools = { search: vi.fn().mockResolvedValue(response([])), compare: vi.fn(), pharmacy: vi.fn() };
    const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      tools, new InMemoryConversationStore());
    const result = await assistant.execute({ consulta: 'busca Producto Ficticio Alfa' }, 'TEST', 'corr');
    expect(result).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
    expect(result.respuesta).not.toContain('12.34');
  });
  it('limita la comparación a veinte DTO públicos y una sola herramienta', async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...offer,
      medicamento: { ...offer.medicamento, id: `med-${index}` } }));
    const tools = { search: vi.fn(), compare: vi.fn().mockResolvedValue(response(many)), pharmacy: vi.fn() };
    const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      tools, new InMemoryConversationStore());
    const result = await assistant.execute({ consulta: 'compara Producto Ficticio Alfa' }, 'TEST', 'corr');
    expect(result.fuentes).toHaveLength(20);
    expect(tools.compare).toHaveBeenCalledOnce();
    expect(tools.search).not.toHaveBeenCalled();
    expect(tools.pharmacy).not.toHaveBeenCalled();
  });
  it('una falla de F03 no se convierte en datos fabricados', async () => {
    const tools = { search: vi.fn().mockRejectedValue(new Error('Detalle privado TEST')),
      compare: vi.fn(), pharmacy: vi.fn() };
    const assistant = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]),
      tools, new InMemoryConversationStore());
    await expect(assistant.execute({ consulta: 'busca Producto Ficticio Alfa' }, 'TEST', 'corr'))
      .rejects.toThrow('Detalle privado TEST');
  });
});
