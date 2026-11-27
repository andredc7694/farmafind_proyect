import { describe, expect, it, vi } from 'vitest';
import { SearchPublicOffers, searchCacheKey } from '../../src/modules/busqueda/application/search-public-offers.js';
import { SuggestPublicOffers } from '../../src/modules/busqueda/application/suggest-public.js';
import type { MatchedOffer, PublicOfferRepository } from '../../src/modules/busqueda/application/ports.js';
import { PUBLIC_NOTICE, type PublicOffer } from '../../src/modules/busqueda/contracts/public-search.js';
import { parsePublicQuery } from '../../src/modules/busqueda/domain/public-query.js';
import { normalizeSearchText, searchTerms, type SearchTerms } from '../../src/modules/busqueda/domain/search-terms.js';

// Datos ficticios: varias concentraciones y presentaciones del mismo medicamento (FR-012).
let sequence = 0;
function offer(nombre: string, concentracion: string | null, presentacion: string | null, precio: number, farmacia = 'alfa',
  principio = nombre): PublicOffer {
  sequence += 1;
  return { medicamento: { id: `m${sequence}`, nombreComercial: nombre, principioActivo: principio,
    concentracion: concentracion as string, presentacion: presentacion as string, clasificacion: 'venta libre' },
  farmacia: { id: farmacia, nombre: `Farmacia ${farmacia}`, direccion: 'Jr. Ficticio 1', ubicacion: null },
  precioReferencialCentavos: precio, disponibilidadReferencial: 'DISPONIBLE', ultimaRevision: '2026-11-27T00:00:00.000Z', distanciaKm: null };
}
const CATALOG: readonly PublicOffer[] = [
  offer('paracetamol', '500 mg', 'tabletas x 10', 250), offer('paracetamol', '500 mg', 'tabletas x 100', 1800, 'beta'),
  offer('paracetamol', '1 g', 'tabletas x 10', 600), offer('paracetamol', '120 mg/5 ml', 'jarabe 60 ml', 900),
  offer('amoxicilina', '500 mg', 'cápsulas x 100', 3500), offer('amoxicilina', '250 mg/5 ml', 'suspensión 60 ml', 1500, 'beta'),
  offer('ibuprofeno', '400mg', 'tabletas x 10', 400), offer('ibuprofeno', '600 mg', 'tabletas x 10', 700, 'beta'),
  offer('ácido acetilsalicílico', '100 mg', 'tabletas x 100', 500), offer('aspirina', '1500 mg', 'sobres x 10', 800, 'beta', 'ácido acetilsalicílico'),
  offer('clorfenamina', null, 'tabletas x 20', 300), offer('loratadina', '10 mg', null, 450, 'beta'),
];

/** Réplica en memoria de f03.search_public_offers_terms (la prueba de base real valida la función SQL). */
class MemoryRepository implements PublicOfferRepository {
  readonly calls: SearchTerms[] = [];
  constructor(private readonly offers: readonly PublicOffer[] = CATALOG) {}
  async search(terms: SearchTerms): Promise<readonly MatchedOffer[]> {
    this.calls.push(terms);
    const result: MatchedOffer[] = [];
    for (const item of this.offers) {
      const { nombreComercial, principioActivo, concentracion, presentacion } = item.medicamento;
      const name = normalizeSearchText([nombreComercial, principioActivo].join(' '));
      const all = normalizeSearchText([nombreComercial, principioActivo, concentracion, presentacion].filter(Boolean).join(' '));
      const words = terms.words.filter(word => word.length >= 2);
      if (!words.some(word => name.includes(word))) continue;
      const parts = all.split(' ');
      result.push({ offer: item, matches: words.filter(word => all.includes(word)).length + terms.tokens.filter(token => parts.includes(token)).length });
    }
    return result.sort((a, b) => b.matches - a.matches);
  }
  async pharmacy() { return null; }
}
const run = (q: string, extra: Record<string, unknown> = {}, repository = new MemoryRepository()) =>
  new SearchPublicOffers(repository, null, { ttlSeconds: 60, candidateLimit: 200 }).execute(parsePublicQuery({ q, ...extra }));
const label = (item: PublicOffer) => `${item.medicamento.nombreComercial} ${item.medicamento.concentracion} ${item.medicamento.presentacion}`;

describe('F03.2 · reglas de texto (FR-001 a FR-003)', () => {
  it('sin tildes ni mayúsculas, número y unidad separados, x10 = x 10, coma decimal', () => {
    expect(normalizeSearchText('ÁCIDO')).toBe('acido');
    expect(normalizeSearchText('Ácido')).toBe('acido');
    expect(normalizeSearchText('IBUPROFENO 400MG')).toBe('ibuprofeno 400 mg');
    expect(normalizeSearchText('tabletas x10')).toBe('tabletas x 10');
    expect(normalizeSearchText('2,5 mg/5ml.')).toBe('2.5 mg 5 ml');
    expect(normalizeSearchText('Cápsulas — Niño')).toBe('capsulas nino');
  });
  it('palabras en singular, números y unidades como tokens, relleno fuera', () => {
    expect(searchTerms('paracetamol 500 mg tabletas x 10')).toEqual({ words: ['paracetamol', 'tableta'], tokens: ['500', 'mg', '10'], nameless: false });
    expect(searchTerms('Amoxicilina Cápsulas')).toEqual({ words: ['amoxicilina', 'capsula'], tokens: [], nameless: false });
    expect(searchTerms('suspensiones de amoxicilina').words).toEqual(['suspension', 'amoxicilina']);
  });
  it('palabras de una letra se descartan; el relleno solo se usa si no hay otra palabra', () => {
    expect(searchTerms('p').words).toEqual([]);
    expect(searchTerms('paracetamol b c').words).toEqual(['paracetamol']);
    expect(searchTerms('para').words).toEqual(['para']);
    expect(searchTerms('para 500').words).toEqual(['para']);
  });
  it('detecta cuando falta el nombre (FR-013)', () => {
    for (const q of ['tabletas', '500 mg', 'capsulas x 100', 'jarabe', '500mg']) expect(searchTerms(q).nameless).toBe(true);
    for (const q of ['paracetamol', 'pa', 'xyzol 500 mg', 'amoxicilina capsulas']) expect(searchTerms(q).nameless).toBe(false);
  });
  it('limita la entrada: máximo 8 palabras y 8 tokens', () => {
    const terms = searchTerms(Array.from({ length: 12 }, (_, i) => `palabra${String.fromCharCode(97 + i)} ${i + 1}`).join(' '));
    expect(terms.words).toHaveLength(8); expect(terms.tokens).toHaveLength(8);
  });
});

describe('F03.2 · búsqueda con texto completo (US1, US2, FR-004 a FR-006, FR-013)', () => {
  it('«paracetamol 500 mg tabletas x 10» trae solo esa presentación (D-02 A)', async () => {
    const result = await run('paracetamol 500 mg tabletas x 10');
    expect(result.coincidencia).toBe('EXACTA');
    expect(result.ofertas.map(label)).toEqual(['paracetamol 500 mg tabletas x 10']);
  });
  it('«paracetamol 500» trae las dos de 500 mg, de menor a mayor precio, sin la de 1 g ni el jarabe', async () => {
    const result = await run('paracetamol 500', { orden: 'precio_asc' });
    expect(result.coincidencia).toBe('EXACTA');
    expect(result.ofertas.map(label)).toEqual(['paracetamol 500 mg tabletas x 10', 'paracetamol 500 mg tabletas x 100']);
  });
  it('«amoxicilina capsulas» sin tilde trae solo cápsulas', async () => {
    expect((await run('amoxicilina capsulas')).ofertas.map(label)).toEqual(['amoxicilina 500 mg cápsulas x 100']);
  });
  it('«ibuprofeno 400mg», «IBUPROFENO 400 MG» e «ibuprofeno 400 mg» dan lo mismo (dato guardado como «400mg»)', async () => {
    const results = await Promise.all(['ibuprofeno 400mg', 'IBUPROFENO 400 MG', 'ibuprofeno 400 mg'].map(q => run(q)));
    for (const result of results) expect(result.ofertas.map(label)).toEqual(['ibuprofeno 400mg tabletas x 10']);
  });
  it('«ÁCIDO», «Ácido» y «acido» dan lo mismo, y encuentran también por principio activo', async () => {
    const results = await Promise.all(['ÁCIDO', 'Ácido', 'acido'].map(q => run(q)));
    for (const result of results) expect(result.ofertas.map(item => item.medicamento.nombreComercial).sort()).toEqual(['aspirina', 'ácido acetilsalicílico']);
  });
  it('«500» no encuentra «1500 mg»', async () => {
    const result = await run('aspirina 500');
    expect(result.coincidencia).toBe('APROXIMADA');
  });
  it('sin la concentración o presentación pedida: todas las del medicamento con APROXIMADA, las más parecidas primero', async () => {
    const result = await run('paracetamol 750 mg tabletas');
    expect(result.coincidencia).toBe('APROXIMADA');
    expect(result.ofertas).toHaveLength(4);
    // 500 mg tabletas coincide en 3 de 4 (paracetamol, tableta, mg); 1 g tabletas y el jarabe, en 2.
    expect(result.ofertas.slice(0, 2).map(label)).toEqual(['paracetamol 500 mg tabletas x 10', 'paracetamol 500 mg tabletas x 100']);
  });
  it('un producto sin presentación y otro sin concentración conservan sus coincidencias', async () => {
    expect((await run('clorfenamina tabletas')).coincidencia).toBe('EXACTA');
    expect((await run('loratadina 10 mg')).coincidencia).toBe('EXACTA');
  });
  it('nombre inexistente: NINGUNA; solo presentación o concentración: FALTA_NOMBRE sin consultar la base', async () => {
    expect((await run('xyzol 500 mg')).coincidencia).toBe('NINGUNA');
    for (const q of ['tabletas', '500 mg']) {
      const repository = new MemoryRepository();
      const result = await run(q, {}, repository);
      expect(result).toMatchObject({ coincidencia: 'FALTA_NOMBRE', ofertas: [], paginacion: { total: 0 } });
      if (q === '500 mg') expect(repository.calls).toHaveLength(0);
    }
  });
  it('palabras cortas no devuelven todo el catálogo', async () => {
    const repository = new MemoryRepository();
    const single = await run('p a', {}, repository);
    expect(single.ofertas).toHaveLength(0);
    expect(repository.calls).toHaveLength(0); // una letra se descarta y «a» es relleno de una letra: no se consulta
    const two = await run('ib');
    expect(new Set(two.ofertas.map(item => item.medicamento.nombreComercial))).toEqual(new Set(['ibuprofeno']));
  });
  it('lo que hoy funciona sigue igual: «paracetamol» y «parace» traen los 4 paracetamoles', async () => {
    for (const q of ['paracetamol', 'parace', 'PARACETAMOL']) {
      const result = await run(q);
      expect(result.coincidencia).toBe('EXACTA'); expect(result.ofertas).toHaveLength(4);
    }
  });
});

describe('F03.2 · ninguna sugerencia lleva a una búsqueda vacía (FR-007)', () => {
  it('recorre todas las sugerencias de lo que se escribe y cada una trae ≥ 1 resultado', async () => {
    const repository = new MemoryRepository();
    const suggest = new SuggestPublicOffers(repository);
    const typed = ['pa', 'para', 'parac', 'paracetamol 5', 'am', 'amox', 'ib', 'ibu', 'ac', 'acido', 'asp', 'clor', 'lora',
      'paracetamol 500', 'amoxicilina caps'];
    const seen = new Set<string>();
    for (const text of typed) for (const item of (await suggest.execute(text)).suggestions) seen.add(item.text);
    expect(seen.size).toBeGreaterThan(10);
    for (const text of seen) {
      const result = await run(text);
      expect(result.paginacion.total, `sugerencia «${text}»`).toBeGreaterThan(0);
      expect(result.coincidencia, `sugerencia «${text}»`).toBe('EXACTA');
    }
  });
});

describe('F03.2 · caché v2 con «coincidencia» (D-03 A, FR-009)', () => {
  const query = parsePublicQuery({ q: 'paracetamol 500' });
  const item = CATALOG[0]!;
  const payload = (extra: Record<string, unknown>) => JSON.stringify({ consulta: query.term, aviso: PUBLIC_NOTICE,
    paginacion: { pagina: 1, tamano: 20, total: 1, totalPaginas: 1 }, ofertas: [item], ...extra });
  const cacheWith = (value: string | null) => ({ generation: vi.fn().mockResolvedValue('0'), get: vi.fn().mockResolvedValue(value),
    set: vi.fn().mockResolvedValue(undefined) });

  it('la clave es v2 y no muestra el término', () => {
    const key = searchCacheKey('3', query);
    expect(key).toMatch(/^farmafind:f03:v2:g3:search:[a-f0-9]{64}$/); expect(key).not.toContain('paracetamol');
  });
  it('una entrada vieja (sin coincidencia) o con un valor desconocido se descarta, se recalcula y se reescribe', async () => {
    for (const extra of [{}, { coincidencia: 'OTRA' }]) {
      const metrics = { record: vi.fn() }; const cache = cacheWith(payload(extra));
      const result = await new SearchPublicOffers(new MemoryRepository(), cache, { ttlSeconds: 60, candidateLimit: 200 }, metrics).execute(query);
      expect(metrics.record).toHaveBeenCalledWith('invalid');
      expect(result.coincidencia).toBe('EXACTA');
      expect(JSON.parse(cache.set.mock.calls[0]![1] as string).coincidencia).toBe('EXACTA');
    }
  });
  it('una entrada nueva es acierto sin consultar la base; la caída de Redis usa PostgreSQL', async () => {
    const repository = new MemoryRepository(); const metrics = { record: vi.fn() };
    const hit = await new SearchPublicOffers(repository, cacheWith(payload({ coincidencia: 'APROXIMADA' })),
      { ttlSeconds: 60, candidateLimit: 200 }, metrics).execute(query);
    expect(metrics.record).toHaveBeenCalledWith('hit'); expect(hit.coincidencia).toBe('APROXIMADA'); expect(repository.calls).toHaveLength(0);
    const broken = { generation: vi.fn().mockRejectedValue(new Error('caído')), get: vi.fn(), set: vi.fn() };
    expect((await new SearchPublicOffers(repository, broken, { ttlSeconds: 60, candidateLimit: 200 }).execute(query)).coincidencia).toBe('EXACTA');
  });
});
