import { describe, expect, it, vi } from 'vitest';
import { F03ConversationPublicTools } from '../../src/modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { assistant, offer, result } from './fixtures/assistant-v2.js';

const alfa = offer({ id: 'med-test', name: 'Producto Ficticio Alfa', principle: 'Compuesto ficticio', strength: 'TEST', presentation: 'TEST', price: 1234 });

describe('frontera pública F03/F07/F07.1 del asistente (F06.2)', () => {
  it('el adaptador delega solo en lecturas públicas', async () => {
    const gateway = { search: vi.fn().mockResolvedValue(result([alfa])), compare: vi.fn(), pharmacy: vi.fn(), suggestNames: vi.fn().mockResolvedValue(['Alfa']) };
    const nearby = { execute: vi.fn().mockResolvedValue({ farmacias: [{ farmaciaId: 'f1', nombre: 'Farmacia Alfa', direccion: 'Jr. A', distanciaLinealKm: 0.4 }] }) };
    const hours = { read: vi.fn().mockResolvedValue({ f1: [] }) };
    const tools = new F03ConversationPublicTools(gateway, nearby, hours);
    expect(await tools.search('TEST', { order: 'cercania', point: { latitude: -13.1, longitude: -74.2 } })).toEqual(result([alfa]));
    expect(gateway.search).toHaveBeenCalledWith('TEST', 'cercania', { latitude: -13.1, longitude: -74.2 });
    expect(await tools.suggestNames('alf')).toEqual(['Alfa']);
    expect(await tools.pharmaciesNear!({ latitude: -13.1, longitude: -74.2 }, 3)).toEqual([{ id: 'f1', nombre: 'Farmacia Alfa', direccion: 'Jr. A', distanciaKm: 0.4 }]);
    expect(nearby.execute).toHaveBeenCalledWith(expect.objectContaining({ kind: 'proximity', term: null, radiusKm: 3 }));
    expect(await tools.openingHours!(['f1'])).toEqual({ f1: [] });
    expect(hours.read).toHaveBeenCalledWith('f1');
    expect(Object.keys(tools).filter(key => typeof (tools as never)[key] === 'function').sort()).toEqual(['openingHours', 'pharmaciesNear']);
  });
  it('sin F07 activo no hay herramientas de lugar ni horario', () => {
    const tools = new F03ConversationPublicTools({ search: vi.fn(), compare: vi.fn(), pharmacy: vi.fn(), suggestNames: vi.fn() });
    expect(tools.pharmaciesNear).toBeUndefined();
    expect(tools.openingHours).toBeUndefined();
  });
  it('construye precio y farmacia solo desde el DTO público de la misma consulta', async () => {
    const tools = { search: vi.fn().mockResolvedValue(result([alfa])), suggestNames: vi.fn() };
    const answer = await assistant(tools).ask('busca Producto Ficticio Alfa');
    expect(tools.search).toHaveBeenCalledOnce();
    expect(answer.estado).toBe('BUSQUEDA_PUBLICA');
    expect(answer.tarjetas).toEqual([expect.objectContaining({ precioCentavos: 1234, farmacia: expect.objectContaining({ nombre: 'Farmacia Alfa' }) })]);
    expect(answer.fuentes).toHaveLength(1);
  });
  it('no inventa ofertas ni precios cuando F03 devuelve cero resultados', async () => {
    const tools = { search: vi.fn().mockResolvedValue(result([])), suggestNames: vi.fn().mockResolvedValue([]) };
    const answer = await assistant(tools).ask('busca Producto Ficticio Alfa');
    expect(answer).toMatchObject({ estado: 'ABSTENCION', fuentes: [] });
    expect(JSON.stringify(answer)).not.toContain('1234');
  });
  it('limita las fuentes a veinte DTO públicos y las tarjetas a tres', async () => {
    const many = Array.from({ length: 25 }, (_, index) => ({ ...alfa, medicamento: { ...alfa.medicamento, id: `med-${index}` } }));
    const tools = { search: vi.fn().mockResolvedValue(result(many)), suggestNames: vi.fn() };
    const answer = await assistant(tools).ask('compara Producto Ficticio Alfa');
    expect(answer.fuentes).toHaveLength(20);
    expect(answer.tarjetas).toHaveLength(3);
    expect(tools.search).toHaveBeenCalledOnce();
  });
  it('una falla de F03 no se convierte en datos fabricados', async () => {
    const tools = { search: vi.fn().mockRejectedValue(new Error('Detalle privado TEST')), suggestNames: vi.fn() };
    await expect(assistant(tools).ask('busca Producto Ficticio Alfa')).rejects.toThrow('Detalle privado TEST');
  });
});
