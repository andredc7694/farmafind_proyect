import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { readPhrase } from '../../src/modules/asistente-ia/domain/assistant-language.js';
import { dosageForm } from '../../src/modules/asistente-ia/domain/dosage-form.js';
import { closestWord, editDistance } from '../../src/modules/asistente-ia/domain/edit-distance.js';
import { todayStatus } from '../../src/modules/asistente-ia/domain/opening-now.js';
import { ASSISTANT_PLACES } from '../../src/modules/asistente-ia/domain/places.js';
import { assistant, catalogTools, offer } from './fixtures/assistant-v2.js';

/** Catálogo ficticio F06.2: varias concentraciones y formas, un «Panadol» ficticio y presentaciones de forma desconocida. */
const CATALOG = [
  offer({ id: 'ibu400a', name: 'Ibuprofeno', strength: '400 mg', presentation: 'caja x 10 tabletas', pharmacy: 'Alfa', price: 150, distance: 1.2 }),
  offer({ id: 'ibu400b', name: 'Ibuprofeno', strength: '400 mg', presentation: 'caja x 10 tabletas', pharmacy: 'Beta', price: 120, distance: 0.3 }),
  offer({ id: 'ibu600a', name: 'Ibuprofeno', strength: '600 mg', presentation: 'caja x 10 tabletas', pharmacy: 'Alfa', price: 200, distance: 1.2 }),
  offer({ id: 'amoxa', name: 'Amoxicilina', strength: '500 mg', presentation: 'caja x 12 cápsulas', pharmacy: 'Alfa', price: 300, distance: 0.5 }),
  offer({ id: 'amoxb', name: 'Amoxicilina', strength: '500 mg', presentation: 'caja x 12 cápsulas', pharmacy: 'Beta', price: 250, distance: 2.1 }),
  offer({ id: 'panadol', name: 'Panadol', principle: 'Paracetamol', strength: '500 mg', presentation: 'caja x 10 tabletas', pharmacy: 'Alfa', price: 900 }),
  offer({ id: 'para-tab', name: 'Paracetamol Genérico', principle: 'Paracetamol', strength: '500 mg', presentation: 'caja x 100 tabletas', pharmacy: 'Beta', price: 300 }),
  offer({ id: 'para-caja', name: 'Paracetamol Ficticio', principle: 'Paracetamol', strength: '500 mg', presentation: 'caja x 30', pharmacy: 'Gamma', price: 200 }),
  offer({ id: 'para-jar', name: 'Paracetamol Jarabe', principle: 'Paracetamol', strength: '500 mg', presentation: 'frasco jarabe 120 ml', pharmacy: 'Gamma', price: 100 }),
];
const FORBIDDEN = /equivalente|reemplaz|sustitu|gen[eé]rico de|puedes cambiar/i;

describe('F06.2 dominio', () => {
  it('forma farmacéutica: solo una forma conocida; «caja x 30», «frasco» o dos formas → desconocida', () => {
    expect(dosageForm('caja x 10 tabletas')).toBe('tableta');
    expect(dosageForm('Caja x 12 Cápsulas')).toBe('capsula');
    expect(dosageForm('frasco jarabe 120 ml')).toBe('jarabe');
    for (const unknown of ['caja x 30', 'frasco 120 ml', 'polvo para suspensión', 'unidad', '']) expect(dosageForm(unknown)).toBeNull();
  });
  it('distancia de edición propia y «¿Quisiste decir…?» con límites', () => {
    expect(editDistance('ibuprofemo', 'ibuprofeno')).toBe(1);
    expect(editDistance('amoxisilina', 'amoxicilina')).toBe(1);
    expect(editDistance('paracetmaol', 'paracetamol')).toBe(1);
    expect(closestWord('ibuprofemo', ['ibuprofeno', 'paracetamol'])).toBe('ibuprofeno');
    expect(closestWord('xyz', ['xyza'])).toBeNull();
    expect(closestWord('zzzzmedicina', ['ibuprofeno'])).toBeNull();
    expect(closestWord('abcd', ['abce', 'abcf'])).toBeNull();
  });
  it('lee intención, distrito, concentración y nombre dentro de frases naturales', () => {
    expect(readPhrase('¿En qué farmacia el ibuprofeno está más barato?')).toMatchObject({ intent: 'PRECIO', medicineWords: ['ibuprofeno'] });
    expect(readPhrase('¿Dónde hay amoxicilina cerca?')).toMatchObject({ intent: 'CERCANIA', medicineWords: ['amoxicilina'] });
    expect(readPhrase('¿Qué farmacia está abierta ahora?')).toMatchObject({ intent: 'HORARIO', medicineWords: [] });
    expect(readPhrase('¿Hay algo más barato que Panadol?')).toMatchObject({ intent: 'ALTERNATIVA', medicineWords: ['panadol'] });
    expect(readPhrase('¿y en Carmen Alto?')).toMatchObject({ followUp: true, medicineWords: [], place: { name: 'Carmen Alto' } });
    expect(readPhrase('¿y el de 600 mg?')).toMatchObject({ followUp: true, strength: '600 mg', medicineWords: [] });
    expect(readPhrase('paracetamol en huamanga')).toMatchObject({ place: { name: 'Ayacucho' }, medicineWords: ['paracetamol'] });
  });
  it('horario de hoy en hora de Lima', () => {
    const friday10 = new Date('2026-11-27T15:00:00.000Z');
    expect(todayStatus([{ dia: 5, cerrado: false, abre: '08:00', cierra: '20:00' }], friday10)).toEqual({ abierto: true, texto: 'Abierto hasta 20:00' });
    expect(todayStatus([{ dia: 5, cerrado: true, abre: null, cierra: null }], friday10)).toEqual({ abierto: false, texto: 'Cerrado hoy' });
    expect(todayStatus([], friday10).texto).toBe('Horario no publicado');
  });
  it('paridad de lugares con la lista de «¿Dónde buscas?» de la pantalla', () => {
    const screen = readFileSync(new URL('../../../frontend/src/search/search-places.js', import.meta.url), 'utf8');
    const rows = [...screen.matchAll(/\['\d{6}', '([^']+)', (-?[\d.]+), (-?[\d.]+)\]/g)].map(m => ({ name: m[1], latitude: Number(m[2]), longitude: Number(m[3]) }));
    expect(rows).toHaveLength(16);
    expect(ASSISTANT_PLACES.map(place => ({ ...place }))).toEqual(rows);
  });
});

describe('F06.2 frases del pedido (MOCK, herramientas falsas)', () => {
  it('precio: aclara la concentración con botones, luego 3 tarjetas por precio y «Ver todas»', async () => {
    const tools = catalogTools(CATALOG);
    const { ask } = assistant(tools);
    const first = await ask('¿En qué farmacia el ibuprofeno está más barato?');
    expect(first).toMatchObject({ estado: 'ACLARACION', contexto: { intencion: 'PRECIO', medicamento: 'ibuprofeno' } });
    expect(first.opciones).toEqual([{ texto: 'Ibuprofeno 400 mg · tableta', consulta: 'ibuprofeno 400 mg tableta' },
      { texto: 'Ibuprofeno 600 mg · tableta', consulta: 'ibuprofeno 600 mg tableta' }]);
    expect(first.verTodas).toEqual({ texto: 'Ver todas en Buscar medicamentos', url: '/search?q=ibuprofeno' });
    const chosen = await ask(first.opciones![0].consulta, first.contexto);
    expect(chosen.estado).toBe('BUSQUEDA_PUBLICA');
    expect(chosen.tarjetas!.map(card => card.precioCentavos)).toEqual([120, 150]);
    expect(chosen.contexto).toEqual({ intencion: 'PRECIO', medicamento: 'ibuprofeno', concentracion: '400 mg', forma: 'tableta' });
    expect(chosen.tarjetas![0].reservarUrl).toBe('/reservations?pharmacyId=farm-beta&medicationId=ibu400b');
    const other = await ask('¿y el de 600 mg?', chosen.contexto);
    expect(other.tarjetas!.map(card => card.producto!.id)).toEqual(['ibu600a']);
  });

  it('«¿y en Carmen Alto?» continúa la búsqueda por cercanía a ese distrito; sin contexto no recuerda', async () => {
    const tools = catalogTools(CATALOG);
    const { ask } = assistant(tools);
    const context = { intencion: 'PRECIO' as const, medicamento: 'ibuprofeno', concentracion: '400 mg', forma: 'tableta' as const };
    const near = await ask('¿y en Carmen Alto?', context);
    expect(tools.search).toHaveBeenLastCalledWith('ibuprofeno', { order: 'cercania', point: { latitude: -13.1794, longitude: -74.2206 } });
    expect(near).toMatchObject({ estado: 'BUSQUEDA_PUBLICA', contexto: { intencion: 'CERCANIA', distrito: 'Carmen Alto' } });
    expect(near.tarjetas!.map(card => card.distanciaKm)).toEqual([0.3, 1.2]);
    const reloaded = await ask('¿y en Carmen Alto?');
    expect(reloaded.tarjetas).toBeUndefined();
  });

  it('cerca: con el distrito elegido en la búsqueda ordena por distancia; sin lugar pide el distrito con botones', async () => {
    const { ask } = assistant(catalogTools(CATALOG));
    const near = await ask('¿Dónde hay amoxicilina cerca?', { distrito: 'Ayacucho' });
    expect(near.tarjetas!.map(card => card.farmacia.nombre)).toEqual(['Farmacia Alfa', 'Farmacia Beta']);
    expect(near.respuesta).toContain('más cerca de Ayacucho');
    const missing = await ask('¿Dónde hay amoxicilina cerca?');
    expect(missing).toMatchObject({ estado: 'ACLARACION', contexto: { intencion: 'CERCANIA', medicamento: 'amoxicilina' } });
    expect(missing.opciones!.map(option => option.consulta)).toContain('en Carmen Alto');
    expect(missing.opciones!.length).toBeLessThanOrEqual(6);
  });

  it('abierta ahora: pide distrito y luego muestra solo farmacias abiertas en hora de Lima', async () => {
    const pharmaciesNear = vi.fn(async () => [
      { id: 'farm-alfa', nombre: 'Farmacia Alfa', direccion: 'Jr. Alfa 123', distanciaKm: 0.4 },
      { id: 'farm-beta', nombre: 'Farmacia Beta', direccion: 'Jr. Beta 123', distanciaKm: 0.9 }]);
    const openingHours = vi.fn(async () => ({ 'farm-alfa': [{ dia: 5, cerrado: false, abre: '08:00', cierra: '20:00' }],
      'farm-beta': [{ dia: 5, cerrado: true, abre: null, cierra: null }] }));
    const { ask } = assistant(catalogTools(CATALOG, { pharmaciesNear, openingHours }));
    const first = await ask('¿Qué farmacia está abierta ahora?');
    expect(first).toMatchObject({ estado: 'ACLARACION', contexto: { intencion: 'HORARIO' } });
    const open = await ask(first.opciones!.find(option => option.texto === 'Carmen Alto')!.consulta, first.contexto);
    expect(open.estado).toBe('BUSQUEDA_PUBLICA');
    expect(open.tarjetas).toEqual([expect.objectContaining({ farmacia: expect.objectContaining({ id: 'farm-alfa' }), horarioHoy: 'Abierto hasta 20:00', producto: null, reservarUrl: null })]);
    expect(pharmaciesNear).toHaveBeenCalledWith({ latitude: -13.1794, longitude: -74.2206 }, 3);
  });

  it('alternativa: solo mismo principio activo, concentración y forma conocida, más baratas, con etiqueta y aviso', async () => {
    const { ask } = assistant(catalogTools(CATALOG));
    const answer = await ask('¿Hay algo más barato que Panadol?');
    expect(answer.estado).toBe('BUSQUEDA_PUBLICA');
    expect(answer.tarjetas!.map(card => card.producto!.id)).toEqual(['para-tab']); // fuera: «caja x 30» (forma desconocida) y jarabe
    expect(answer.tarjetas![0].etiqueta).toBe('Mismo principio activo y concentración');
    expect(answer.respuesta).toContain('Consulta al químico farmacéutico antes de cambiar de producto.');
    expect(JSON.stringify([answer.respuesta, answer.tarjetas])).not.toMatch(FORBIDDEN);
  });

  it('alternativa: si la forma de la referencia no está clara o no hay otra con la misma forma, no muestra tarjetas', async () => {
    const unknown = [offer({ id: 'pan30', name: 'Panadol', principle: 'Paracetamol', strength: '500 mg', presentation: 'caja x 30', price: 900 }),
      offer({ id: 'p1', name: 'Paracetamol Genérico', principle: 'Paracetamol', strength: '500 mg', presentation: 'caja x 100 tabletas', price: 100 })];
    const first = await assistant(catalogTools(unknown)).ask('¿Hay algo más barato que Panadol?');
    expect(first.tarjetas).toBeUndefined();
    expect(first.respuesta).toContain('forma farmacéutica no está clara');
    const alone = [CATALOG[5], CATALOG[7], CATALOG[8]];
    const second = await assistant(catalogTools(alone)).ask('¿Hay algo más barato que Panadol?');
    expect(second.tarjetas).toBeUndefined();
    expect(second.respuesta).toContain('No encontré otros productos con la misma forma farmacéutica publicada');
    for (const text of [first.respuesta, second.respuesta]) expect(text).not.toMatch(FORBIDDEN);
  });

  it.each([['ibuprofemo', 'ibuprofeno'], ['amoxisilina', 'amoxicilina'], ['¿precio del paracetmaol?', 'paracetamol']])(
    '«%s» → «¿Quisiste decir %s?» con botón que reenvía la frase corregida', async (typo, right) => {
      const answer = await assistant(catalogTools(CATALOG)).ask(typo);
      expect(answer.estado).toBe('ABSTENCION');
      expect(answer.sugerencia).toEqual({ texto: `¿Quisiste decir ${right}?`, consulta: expect.stringContaining(right) });
      expect(answer.tarjetas).toBeUndefined();
    });

  it.each(['tengo dolor de pecho', 'Me desmayo, ¿dónde está más barato el ibuprofeno?', 'mi hijo convulsiona'])(
    'emergencia «%s»: primero y sola, con 106/116/105 y fuente, sin tarjetas ni herramientas', async text => {
      const tools = catalogTools(CATALOG);
      const answer = await assistant(tools).ask(text, { intencion: 'PRECIO', medicamento: 'ibuprofeno' });
      expect(answer.estado).toBe('URGENCIA');
      expect(answer.emergencia!.numeros.map(item => item.numero)).toEqual(['106', '116', '105']);
      expect(answer.emergencia!.verificadoEl).toBe('2026-11-27');
      expect(answer.emergencia!.fuentes[0].url).toMatch(/^https:\/\/www\.gob\.pe\//);
      expect(answer).not.toHaveProperty('tarjetas'); expect(answer).not.toHaveProperty('opciones'); expect(answer).not.toHaveProperty('sugerencia');
      expect(answer.contexto).toEqual({});
      expect(tools.search).not.toHaveBeenCalled();
    });

  it('«el más barato cerca»: solo farmacias a ≤ 5 km, de menor a mayor precio; el botón de aclaración conserva el pedido', async () => {
    const offers = [offer({ id: 'a', name: 'Ibuprofeno', strength: '400 mg', pharmacy: 'Cerca', price: 300, distance: 0.2 }),
      offer({ id: 'b', name: 'Ibuprofeno', strength: '400 mg', pharmacy: 'Media', price: 200, distance: 2 }),
      offer({ id: 'c', name: 'Ibuprofeno', strength: '400 mg', pharmacy: 'Lejos', price: 50, distance: 8 })];
    const { ask } = assistant(catalogTools(offers));
    const answer = await ask('ibuprofeno más barato cerca', { distrito: 'Carmen Alto' });
    expect(answer.tarjetas!.map(card => card.producto!.id)).toEqual(['b', 'a']);
    expect(answer.respuesta).toContain('a menos de 5 km de Carmen Alto');
    const choices = await assistant(catalogTools(CATALOG)).ask('ibuprofeno más barato cerca', { distrito: 'Carmen Alto' });
    expect(choices.opciones![0].consulta).toBe('ibuprofeno 400 mg tableta mas barato cerca');
  });

  it('sin resultados lo dice nombrando el medicamento y sin inventar', async () => {
    const answer = await assistant(catalogTools(CATALOG)).ask('¿Dónde está más barato el zzzzmedicina?');
    expect(answer.respuesta).toContain('«zzzzmedicina»');
    expect(answer.tarjetas).toBeUndefined();
  });

  it('una concentración que no existe ofrece las publicadas', async () => {
    const answer = await assistant(catalogTools(CATALOG)).ask('precio del ibuprofeno 800 mg');
    expect(answer.estado).toBe('ACLARACION');
    expect(answer.respuesta).toContain('No encontré «Ibuprofeno 800 mg» publicado');
    expect(answer.opciones).toHaveLength(2);
  });
});
