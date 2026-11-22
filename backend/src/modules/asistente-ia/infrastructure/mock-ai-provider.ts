import type { AIProvider } from '../application/ports.js';
import type { ProviderDecision } from '../domain/assistant-contract.js';

const HELP = /\b(ayuda|c[oó]mo|instrucciones|qu[eé] puedes hacer)\b/iu;
const COMPARE = /\b(compara|comparar|comparaci[oó]n|m[aá]s barato|menor precio|versus| vs )\b/iu;
function term(query: string): string {
  return query.toLocaleLowerCase('es').replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\b(busca|buscar|encuentra|comparar?|comparaci[oó]n|precio|precios|m[aá]s barato|menor|versus|por favor|de|del)\b/giu, ' ')
    .replace(/\s+/g, ' ').trim().slice(0, 120);
}
export class MockAIProvider implements AIProvider {
  async classify(query: string): Promise<ProviderDecision> {
    if (HELP.test(query)) return { intent: 'AYUDA', term: null };
    const pharmacyId=query.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/iu)?.[0];
    if (pharmacyId) return {intent:'BUSQUEDA',term:null,pharmacyId};
    const extracted = term(query);
    if (!extracted) return { intent: 'AYUDA', term: null };
    return { intent: COMPARE.test(query) ? 'COMPARACION' : 'BUSQUEDA', term: extracted };
  }
}
