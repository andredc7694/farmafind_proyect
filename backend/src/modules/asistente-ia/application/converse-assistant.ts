import type { ConversationRequest, ConversationResponse, ConversationCitation } from '../domain/conversation-contract.js';
import { classifyConversationSafety, EDUCATIONAL_NOTICE } from '../domain/conversation-policy.js';
import type { ConversationProvider, ConversationPublicTools, ConversationStore, ReviewedSourceCatalog } from './conversation-ports.js';

const ABSTAIN = 'No dispongo de una fuente revisada y vigente para responder con seguridad.';

function bounded<T>(operation: Promise<T>, milliseconds = 1_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('conversation timeout')), milliseconds);
    operation.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}

/** All substantive claims are copied from an approved TEST source or a public F03 DTO. */
export class ConverseAssistant {
  constructor(private readonly provider: ConversationProvider, private readonly sources: ReviewedSourceCatalog,
    private readonly tools: ConversationPublicTools, private readonly contexts: ConversationStore,
    private readonly now: () => Date = () => new Date()) {}

  async execute(request: ConversationRequest, origin: string, correlationId: string): Promise<ConversationResponse> {
    const safety = classifyConversationSafety(request.consulta);
    if (safety.kind !== 'ALLOW') return {
      estado: safety.kind === 'URGENT' ? 'URGENCIA' : 'CLINICA_RECHAZADA', respuesta: safety.message,
      aviso: EDUCATIONAL_NOTICE, fuentes: [], correlationId, proveedor: 'mock',
    };

    // A context must belong to this origin before any provider or tool is called.
    const prior = request.conversacionId ? this.contexts.get(origin, request.conversacionId) : null;
    const decision = await bounded(this.provider.classify(request.consulta));
    if (!['SOURCE', 'SYMPTOM', 'PUBLIC_SEARCH', 'PUBLIC_COMPARE', 'HELP'].includes(decision?.intent) ||
        (decision.term !== null && typeof decision.term !== 'string')) throw new Error('invalid provider decision');
    let estado: ConversationResponse['estado'] = 'AYUDA';
    let respuesta = 'Modo DEMO: puedo consultar información pública de FarmaFind. La IA generativa externa no está habilitada; sin fichas revisadas me abstengo de dar información farmacológica.';
    let fuentes: readonly ConversationCitation[] = [];
    let referent = prior?.referent ?? null;

    if (decision.intent === 'SOURCE' || decision.intent === 'SYMPTOM') {
      const source = this.sources.lookup(decision.term ?? request.consulta, this.now()) ??
        (referent ? this.sources.lookup(referent, this.now()) : null);
      if (!source) { estado = 'ABSTENCION'; respuesta = ABSTAIN; }
      else {
        referent = source.productName;
        estado = 'INFORMATIVA';
        respuesta = source.educationalStatement;
        if (/advertencias?|precauciones?/iu.test(request.consulta) && source.educationalWarning) {
          respuesta = source.educationalWarning;
        }
        fuentes = [{ tipo: 'FICHA', titulo: source.title, referencia: source.reference,
          revisadoEl: source.reviewedAt, vigenteHasta: source.validUntil }];
      }
    } else if ((decision.intent === 'PUBLIC_SEARCH' || decision.intent === 'PUBLIC_COMPARE') && decision.term) {
      const result = await bounded(decision.intent === 'PUBLIC_COMPARE'
        ? this.tools.compare(decision.term) : this.tools.search(decision.term));
      const offers = result.ofertas.slice(0, 20);
      if (offers.length === 0) { estado = 'ABSTENCION'; respuesta = 'No hay ofertas públicas verificables para esta consulta.'; }
      else {
        estado = 'BUSQUEDA_PUBLICA';
        respuesta = offers.map(offer => `${offer.medicamento.nombreComercial}: ${offer.farmacia.nombre}; precio referencial ${offer.precioReferencialCentavos} céntimos; disponibilidad referencial ${offer.disponibilidadReferencial}; revisado ${offer.ultimaRevision}.`).join(' ');
        fuentes = offers.map(offer => ({ tipo: 'OFERTA_PUBLICA', titulo: offer.medicamento.nombreComercial,
          referencia: `farmafind://oferta/${offer.medicamento.id}/${offer.farmacia.id}`, revisadoEl: offer.ultimaRevision }));
      }
    }

    const context = prior ? this.contexts.advance(origin, prior.id, referent) : this.contexts.create(origin, referent);
    return { estado, respuesta, aviso: EDUCATIONAL_NOTICE, fuentes, correlationId, proveedor: 'mock',
      conversacionId: context.id, expiraEn: new Date(context.expiresAt).toISOString() };
  }

  discard(origin: string, id: string): void { this.contexts.discard(origin, id); }
}
