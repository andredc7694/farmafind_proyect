/** Opt-in developer smoke only. Never imported by the application or browser. */
import { GeminiConversationProvider } from '../../backend/dist/modules/asistente-ia/infrastructure/gemini-conversation-provider.js';

const model = 'gemini-3.5-flash-lite';
const approval = `${model}:3-requests:synthetic-only`;
if (process.env.F061_GEMINI_LIVE_APPROVAL !== approval ||
    process.env.F061_GEMINI_FREE_TIER_CONFIRMED !== '1' ||
    process.env.F061_GEMINI_MODEL !== model) {
  throw new Error('Prueba real bloqueada: faltan aprobación explícita de modelo/privacidad/límite y confirmación Free Tier');
}
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) throw new Error('Prueba real bloqueada: falta clave backend local');

// Fixed, non-personal developer prompts. No user text, clinical context or pharmacy data is sent.
const prompts = [
  '¿Cómo puedo buscar medicamentos en FarmaFind?',
  '¿Qué información pública muestran las farmacias?',
  '¿Puedes comparar productos publicados?',
];
const provider = new GeminiConversationProvider({ apiKey, model, timeoutMs: 5_000,
  maxCalls: 3, maxTotalTokens: 1_000 });
const results = [];
for (const [index, prompt] of prompts.entries()) {
  if (provider.getUsage().requests >= 3 || provider.getUsage().totalTokens >= 1_000) break;
  try {
    const decision = await provider.classify(prompt);
    results.push({ case: index + 1, status: 'ok', intent: decision.intent });
  } catch {
    results.push({ case: index + 1, status: 'error-or-budget' });
    break;
  }
}
// This scenario is intentionally not submitted: the reviewed source corpus is still empty.
results.push({ case: 'pharmacological-options', status: 'blocked-no-reviewed-source' });
const usage = provider.getUsage();
process.stdout.write(`${JSON.stringify({ model, requests: usage.requests,
  reportedTokens: usage.totalTokens, results })}\n`);
if (results.some(result => result.status === 'error-or-budget')) process.exitCode = 1;
