import { randomUUID } from 'node:crypto';
import type { AIProvider, AssistantClock, AssistantMetrics, PublicKnowledgeTools } from './ports.js';
import { NO_ASSISTANT_METRICS, SYSTEM_CLOCK } from './ports.js';
import { AssistantError, type AssistantResponse, type ProviderDecision } from '../domain/assistant-contract.js';
import { CLINICAL_REFUSAL, isClinicalRequest } from '../domain/clinical-policy.js';
import { ASSISTANT_NOTICE, groundSearch } from '../domain/grounded-response.js';

function valid(value: unknown): value is ProviderDecision {
  if (typeof value !== 'object' || value === null) return false;
  const d=value as ProviderDecision;
  const keys=Object.keys(value).sort();
  if (keys.some(key=>!['intent','pharmacyId','term'].includes(key))) return false;
  return ['BUSQUEDA','COMPARACION','AYUDA'].includes(d.intent) && (d.term === null || typeof d.term === 'string') &&
    (d.pharmacyId===undefined || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(d.pharmacyId));
}
export class QueryAssistant {
  constructor(private readonly provider: AIProvider, private readonly tools: PublicKnowledgeTools,
    private readonly metrics: AssistantMetrics = NO_ASSISTANT_METRICS, private readonly clock: AssistantClock = SYSTEM_CLOCK,
    private readonly timeoutMs = 1_000) {}
  async execute(query: string, correlationId = randomUUID()): Promise<AssistantResponse> {
    const start=this.clock.now();
    if (isClinicalRequest(query)) {
      this.metrics.record({event:'clinical_refusal',durationMs:this.clock.now()-start,intent:'CLINICA_RECHAZADA',toolCount:0});
      return { intencion:'CLINICA_RECHAZADA', respuesta:CLINICAL_REFUSAL, fuentes:[], aviso:ASSISTANT_NOTICE, proveedor:'mock', correlationId };
    }
    let decision: ProviderDecision;
    try {
      decision = await Promise.race([this.provider.classify(query), new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('timeout')),this.timeoutMs))]);
      if (!valid(decision)) throw new AssistantError('INVALID_INTENT','El proveedor devolvió una intención inválida.');
    } catch (error) {
      this.metrics.record({event:'provider_error',durationMs:this.clock.now()-start,intent:'INVALIDA',toolCount:0});
      if (error instanceof AssistantError) throw error;
      throw new AssistantError('PROVIDER_UNAVAILABLE','El asistente no está disponible temporalmente.');
    }
    if (decision.pharmacyId) {
      try {
        const pharmacy=await this.tools.pharmacy(decision.pharmacyId);
        this.metrics.record({event:'success',durationMs:this.clock.now()-start,intent:'BUSQUEDA',toolCount:1});
        return {intencion:'BUSQUEDA',respuesta:pharmacy?`Encontré la información pública de ${pharmacy.nombre}.`:'No encontré información pública verificable para esa farmacia.',fuentes:pharmacy?[{tipo:'FARMACIA',farmacia:pharmacy}]:[],aviso:ASSISTANT_NOTICE,proveedor:'mock',correlationId};
      } catch {
        this.metrics.record({event:'source_error',durationMs:this.clock.now()-start,intent:'BUSQUEDA',toolCount:1});
        throw new AssistantError('SOURCE_UNAVAILABLE','La información pública no está disponible temporalmente.');
      }
    }
    if (decision.intent === 'AYUDA' || !decision.term) {
      this.metrics.record({event:'success',durationMs:this.clock.now()-start,intent:'AYUDA',toolCount:0});
      return { intencion:'AYUDA', respuesta:'Puedo buscar y comparar información pública de medicamentos, precios referenciales y farmacias. Usa los filtros de búsqueda para acotar resultados; las reservas se gestionan desde su sección y nunca las ejecuto por ti. No brindo orientación clínica.', fuentes:[], aviso:ASSISTANT_NOTICE, proveedor:'mock', correlationId };
    }
    try {
      const grounded=groundSearch(decision.intent, decision.intent === 'COMPARACION' ? await this.tools.compare(decision.term) : await this.tools.search(decision.term));
      this.metrics.record({event:'success',durationMs:this.clock.now()-start,intent:decision.intent,toolCount:1});
      return { intencion:decision.intent, ...grounded, aviso:ASSISTANT_NOTICE, proveedor:'mock', correlationId };
    } catch {
      this.metrics.record({event:'source_error',durationMs:this.clock.now()-start,intent:decision.intent,toolCount:1});
      throw new AssistantError('SOURCE_UNAVAILABLE','La información pública no está disponible temporalmente.');
    }
  }
}
