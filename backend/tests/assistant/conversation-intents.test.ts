import { describe, expect, it } from 'vitest';
import { medicineTerm } from '../../src/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { assistant, catalogTools, offer } from './fixtures/assistant-v2.js';

/** Regresión F06.1 adaptada a F06.2: mismas intenciones; la lista de ofertas pasa a tarjetas (≤ 3) + «Ver todas». */
const catalog = (names = ['paracetamol', 'aciclovir', 'ácido fólico']) =>
  names.flatMap((name, n) => [1, 2].map(i => offer({ id: `m${n}-${i}`, name, pharmacy: `P${n}${i}`, price: 100 + i })));

describe('intenciones del asistente MOCK', () => {
  it.each(['hola', '¡Hola!', 'Buenos días', 'hola, qué tal'])('saluda cordialmente a «%s» sin consultar ofertas', async text => {
    const tools = catalogTools(catalog());
    const answer = await assistant(tools).ask(text);
    expect(answer).toMatchObject({ estado: 'AYUDA', fuentes: [] });
    expect(answer.respuesta).toMatch(/^¡Hola!/);
    expect(tools.search).not.toHaveBeenCalled();
  });

  it.each(['¿Qué información puedes mostrarme?', '¿Qué información puedes darme?', '¿Qué puedes hacer por mí?', '¿Qué significa disponibilidad referencial?'])(
    'explica qué muestra ante «%s»', async text => {
      const answer = await assistant(catalogTools(catalog())).ask(text);
      for (const word of ['nombre', 'concentración', 'presentación', 'precio referencial', 'disponibilidad referencial']) expect(answer.respuesta).toContain(word);
      expect(answer.estado).toBe('AYUDA');
    });

  it.each([['Aciclovir', 'aciclovir'], ['Paracetamol', 'paracetamol'], ['paracetamol 500 mg', 'paracetamol'], ['Compara el precio de paracetamol entre farmacias', 'paracetamol'],
    ['¿Cuánto cuesta el ácido fólico?', 'acido folico'], ['precio del medicamento aciclovir', 'aciclovir']])('compara precios de «%s» solo con ofertas públicas', async (text, term) => {
    const tools = catalogTools(catalog());
    const answer = await assistant(tools).ask(text);
    expect(tools.search).toHaveBeenCalledWith(term, { order: 'precio_asc' });
    expect(answer.estado).toBe('BUSQUEDA_PUBLICA');
    expect(answer.tarjetas?.[0]).toMatchObject({ precioCentavos: 101, reservarUrl: expect.stringContaining('/reservations?pharmacyId=') });
    expect(answer.verTodas?.url).toMatch(/^\/search\?q=/);
    expect(JSON.stringify(answer)).not.toMatch(/stock|cantidad|existencias físicas/i);
  });

  it('muestra 3 tarjetas, ordenadas por precio, y conserva las fuentes (≤ 20)', async () => {
    const many = Array.from({ length: 9 }, (_, i) => offer({ id: `p${i}`, name: 'paracetamol', pharmacy: `F${i}`, price: 900 - i * 10 }));
    const answer = await assistant(catalogTools(many)).ask('Paracetamol');
    expect(answer.tarjetas).toHaveLength(3);
    expect(answer.tarjetas!.map(card => card.precioCentavos)).toEqual([820, 830, 840]);
    expect(answer.respuesta).toContain('9 ofertas publicadas');
    expect(answer.fuentes).toHaveLength(9);
  });

  it('pide el nombre cuando se quiere comparar sin decir qué', async () => {
    const tools = catalogTools(catalog());
    for (const text of ['Compara el precio de', 'comparar precios de un medicamento', '¿Cómo comparo precios entre farmacias?']) {
      expect((await assistant(tools).ask(text)).respuesta).toMatch(/¿De qué medicamento/);
    }
    expect(tools.search).not.toHaveBeenCalled();
  });

  it('sobre farmacias cercanas sin distrito remite al mapa sin pedir ni usar la ubicación', async () => {
    const tools = catalogTools(catalog());
    for (const text of ['¿Dónde hay una farmacia cercana?', 'Buscar una farmacia cercana', 'farmacias cerca de mí']) {
      expect((await assistant(tools).ask(text)).respuesta).toContain('Ver farmacias en el mapa');
    }
    expect(tools.search).not.toHaveBeenCalled();
  });

  it('sin ofertas lo dice con claridad y no inventa', async () => {
    const answer = await assistant(catalogTools([])).ask('Zzzzmedicina');
    expect(answer).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
    expect(answer.respuesta).toContain('No encontré ofertas públicas de «zzzzmedicina»');
    expect(answer.tarjetas).toBeUndefined();
  });

  it.each(['¿Qué dosis de paracetamol tomo?', 'Dame un tratamiento para la gripe', 'Diagnostica este dolor', '¿Para qué sirve el aciclovir?', '¿Cuántas pastillas tomo?'])(
    'rechaza con amabilidad la consulta clínica «%s»', async text => {
      const tools = catalogTools(catalog());
      const answer = await assistant(tools).ask(text);
      expect(answer.estado).toBe('CLINICA_RECHAZADA');
      expect(answer.respuesta).toContain('químico farmacéutico');
      expect(answer.respuesta).toContain('Sí puedo mostrarte precios');
      expect(answer.tarjetas).toBeUndefined();
      expect(tools.search).not.toHaveBeenCalled();
    });

  it('extrae el nombre sin comerse palabras interiores (clasificador F06.1)', () => {
    expect(medicineTerm('busca medicamento primero')).toBe('medicamento primero');
    expect(medicineTerm('busca Producto Ficticio Alfa')).toBe('producto ficticio alfa');
    expect(medicineTerm('precios de ácido acetilsalicílico en farmacias')).toBe('ácido acetilsalicílico');
  });
});
