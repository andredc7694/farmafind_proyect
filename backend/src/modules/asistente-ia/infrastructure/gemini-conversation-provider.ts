import type { ConversationDecision, ConversationProvider } from '../application/conversation-ports.js';
import { classifyConversationSafety } from '../domain/conversation-policy.js';

type Transport = typeof fetch;

/** Inactive adapter. Runtime composition keeps MockConversationProvider until separate approval. */
export class GeminiConversationProvider implements ConversationProvider {
  constructor(private readonly config: { apiKey: string; model: string; timeoutMs: number; maxCalls: number;
    maxTotalTokens?: number },
    private readonly transport: Transport = fetch) {
    if (!config.apiKey || !/^gemini-[a-z0-9.-]+$/u.test(config.model) ||
        !Number.isInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 10_000 ||
        !Number.isInteger(config.maxCalls) || config.maxCalls < 1 || config.maxCalls > 30 ||
        (config.maxTotalTokens !== undefined && (!Number.isInteger(config.maxTotalTokens) ||
          config.maxTotalTokens < 100 || config.maxTotalTokens > 10_000))) {
      throw new Error('Configuración de proveedor no válida');
    }
  }

  private calls = 0;
  private totalTokens = 0;
  private inFlight = false;

  getUsage(): { readonly requests: number; readonly totalTokens: number } {
    return { requests: this.calls, totalTokens: this.totalTokens };
  }

  async classify(query: string): Promise<ConversationDecision> {
    if (this.inFlight) throw new Error('Proveedor ocupado');
    if (this.config.maxTotalTokens !== undefined && this.totalTokens >= this.config.maxTotalTokens) {
      throw new Error('Presupuesto agotado');
    }
    // The caller must apply clinical and privacy controls before invoking this adapter.
    if (typeof query !== 'string' || query.length < 1 || query.length > 500 || this.calls >= this.config.maxCalls) {
      throw new Error('Consulta o cuota no válida');
    }
    if (classifyConversationSafety(query).kind !== 'ALLOW' ||
        /(?:[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b\+?\d[\d\s()-]{7,}\d\b)/u.test(query)) {
      throw new Error('Consulta no apta para proveedor externo');
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.model}:generateContent`;
    const request = {
      systemInstruction: { parts: [{ text: 'Clasifica únicamente la intención. Devuelve JSON con intent SOURCE, PUBLIC_SEARCH, PUBLIC_COMPARE, SYMPTOM o HELP y term texto o null. No respondas preguntas clínicas ni generes hechos.' }] },
      contents: [{ role: 'user', parts: [{ text: query }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 100, temperature: 0 },
    };
    this.inFlight = true;
    try {
      let response: Response | undefined;
      // At most one retry for transient status, and never beyond the configured call budget.
      for (let attempt = 0; attempt < 2 && this.calls < this.config.maxCalls; attempt += 1) {
        this.calls += 1;
        response = await this.transport(url, { method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': this.config.apiKey },
          body: JSON.stringify(request), signal: AbortSignal.timeout(this.config.timeoutMs) });
        if (response.ok || ![429, 502, 503, 504].includes(response.status)) break;
      }
      if (!response) throw new Error('Presupuesto agotado');
      if (!response.ok) throw new Error('Proveedor no disponible');
      const payload: unknown = await response.json();
      if (this.config.maxTotalTokens !== undefined) {
        const usage = (payload as { usageMetadata?: { totalTokenCount?: unknown } })?.usageMetadata?.totalTokenCount;
        if (!Number.isSafeInteger(usage) || (usage as number) < 0) {
          this.totalTokens = this.config.maxTotalTokens;
          throw new Error('Consumo no informado');
        }
        this.totalTokens += usage as number;
        if (this.totalTokens > this.config.maxTotalTokens) throw new Error('Presupuesto agotado');
      }
      const text = (payload as { candidates?: { content?: { parts?: { text?: unknown }[] } }[] })
        ?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof text !== 'string' || text.length > 1_000) throw new Error('Respuesta de proveedor no válida');
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') throw new Error('Respuesta de proveedor no válida');
      const { intent, term } = parsed as Record<string, unknown>;
      if (!['SOURCE', 'PUBLIC_SEARCH', 'PUBLIC_COMPARE', 'SYMPTOM', 'HELP'].includes(String(intent)) ||
          (term !== null && (typeof term !== 'string' || term.length > 500))) {
        throw new Error('Respuesta de proveedor no válida');
      }
      return { intent: intent as ConversationDecision['intent'], term: term as string | null };
    } catch {
      // Never expose provider errors, key or request text to clients or logs.
      throw new Error('Proveedor no disponible');
    } finally {
      this.inFlight = false;
    }
  }
}
