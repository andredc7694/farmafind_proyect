import { describe, expect, it, vi } from 'vitest';
import { ConverseAssistant } from '../../src/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryConversationStore } from '../../src/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../src/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider, medicineTerm } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { PUBLIC_NOTICE } from '../../src/modules/busqueda/contracts/public-search.js';

const offer = (index: number, name = 'paracetamol') => ({ medicamento: { id: `m${index}`, nombreComercial: name, principioActivo: name,
  concentracion: '500 mg', presentacion: 'caja x 10', clasificacion: 'venta libre' }, farmacia: { id: `f${index}`, nombre: `Farmacia ${index}`, direccion: 'TEST' },
precioReferencialCentavos: 100 + index, disponibilidadReferencial: 'DISPONIBLE' as const, ultimaRevision: '2026-11-25T12:00:00.000Z', distanciaKm: null });
const result = (ofertas: ReturnType<typeof offer>[]) => ({ consulta: 'x', ofertas, paginacion: { pagina: 1, tamano: 20, total: ofertas.length, totalPaginas: 1 }, aviso: PUBLIC_NOTICE });

function assistant(offers: ReturnType<typeof offer>[] = [offer(1)]) {
  const tools = { search: vi.fn().mockResolvedValue(result(offers)), compare: vi.fn().mockResolvedValue(result(offers)), pharmacy: vi.fn() };
  const service = new ConverseAssistant(new MockConversationProvider(), new InMemoryReviewedSourceCatalog([]), tools as never, new InMemoryConversationStore());
  return { tools, ask: (consulta: string) => service.execute({ consulta }, 'TEST', 'corr') };
}

describe('intenciones del asistente MOCK', () => {
  it.each(['hola', '¡Hola!', 'Buenos días', 'hola, qué tal'])('saluda cordialmente a «%s» sin consultar ofertas', async text => {
    const { ask, tools } = assistant();
    const answer = await ask(text);
    expect(answer).toMatchObject({ estado: 'AYUDA', fuentes: [] });
    expect(answer.respuesta).toMatch(/^¡Hola!/);
    expect(tools.compare).not.toHaveBeenCalled(); expect(tools.search).not.toHaveBeenCalled();
  });

  it.each(['¿Qué información puedes mostrarme?', '¿Qué información puedes darme?', '¿Qué puedes hacer por mí?', '¿Qué significa disponibilidad referencial?'])(
    'explica qué muestra ante «%s»', async text => {
      const { ask } = assistant();
      const answer = await ask(text);
      for (const word of ['nombre', 'concentración', 'presentación', 'precio referencial', 'disponibilidad referencial']) expect(answer.respuesta).toContain(word);
      expect(answer.estado).toBe('AYUDA');
    });

  it.each([['Aciclovir', 'aciclovir'], ['Paracetamol', 'paracetamol'], ['paracetamol 500 mg', 'paracetamol'], ['Compara el precio de paracetamol entre farmacias', 'paracetamol'],
    ['¿Cuánto cuesta el ácido fólico?', 'ácido fólico'], ['precio del medicamento aciclovir', 'aciclovir']])('compara precios de «%s» solo con ofertas públicas', async (text, term) => {
    const { ask, tools } = assistant();
    const answer = await ask(text);
    expect(tools.compare).toHaveBeenCalledWith(term);
    expect(answer.estado).toBe('BUSQUEDA_PUBLICA');
    expect(answer.respuesta).toContain('S/ 1.01');
    expect(answer.respuesta).not.toMatch(/stock|cantidad|existencias físicas/i);
  });

  it('lista pocas ofertas en el texto, avisa cuántas más hay y conserva las fuentes', async () => {
    const { ask } = assistant(Array.from({ length: 9 }, (_, index) => offer(index)));
    const answer = await ask('Paracetamol');
    expect(answer.respuesta.split('\n').filter(line => line.startsWith('•'))).toHaveLength(6);
    expect(answer.respuesta).toContain('Hay 3 ofertas más');
    expect(answer.fuentes).toHaveLength(9);
  });

  it('pide el nombre cuando se quiere comparar sin decir qué', async () => {
    const { ask, tools } = assistant();
    for (const text of ['Compara el precio de', 'comparar precios de un medicamento', '¿Cómo comparo precios entre farmacias?']) {
      expect((await ask(text)).respuesta).toMatch(/¿De qué medicamento/);
    }
    expect(tools.compare).not.toHaveBeenCalled();
  });

  it('sobre farmacias cercanas remite al mapa sin pedir ni usar la ubicación', async () => {
    const { ask, tools } = assistant();
    for (const text of ['¿Dónde hay una farmacia cercana?', 'Buscar una farmacia cercana', 'farmacias cerca de mí']) {
      expect((await ask(text)).respuesta).toContain('Ver farmacias en el mapa');
    }
    expect(tools.search).not.toHaveBeenCalled(); expect(tools.compare).not.toHaveBeenCalled();
  });

  it('sin ofertas lo dice con claridad y no inventa', async () => {
    const answer = await assistant([]).ask('Zzzzmedicina');
    expect(answer).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
    expect(answer.respuesta).toContain('No encontré ofertas públicas de «zzzzmedicina»');
  });

  it.each(['¿Qué dosis de paracetamol tomo?', 'Dame un tratamiento para la gripe', 'Diagnostica este dolor', '¿Para qué sirve el aciclovir?'])(
    'rechaza con amabilidad la consulta clínica «%s»', async text => {
      const { ask, tools } = assistant();
      const answer = await ask(text);
      expect(answer.estado).toBe('CLINICA_RECHAZADA');
      expect(answer.respuesta).toContain('químico farmacéutico');
      expect(answer.respuesta).toContain('Sí puedo mostrarte precios');
      expect(tools.compare).not.toHaveBeenCalled(); expect(tools.search).not.toHaveBeenCalled();
    });

  it('extrae el nombre sin comerse palabras interiores', () => {
    expect(medicineTerm('busca medicamento primero')).toBe('medicamento primero');
    expect(medicineTerm('busca Producto Ficticio Alfa')).toBe('producto ficticio alfa');
    expect(medicineTerm('precios de ácido acetilsalicílico en farmacias')).toBe('ácido acetilsalicílico');
  });
});
