/** Isolated browser harness: real F06/F06.1 Express routes, synthetic F03 DTOs, no database or provider. */
import express from 'express';
import { createConversationRouter } from '../../backend/dist/modules/asistente-ia/presentation/conversation-router.js';
import { ConverseAssistant } from '../../backend/dist/modules/asistente-ia/application/converse-assistant.js';
import { InMemoryConversationStore } from '../../backend/dist/modules/asistente-ia/infrastructure/in-memory-conversation-store.js';
import { InMemoryReviewedSourceCatalog } from '../../backend/dist/modules/asistente-ia/infrastructure/reviewed-source-catalog.js';
import { MockConversationProvider } from '../../backend/dist/modules/asistente-ia/infrastructure/mock-conversation-provider.js';
import { F03ConversationPublicTools } from '../../backend/dist/modules/asistente-ia/infrastructure/conversation-public-tools.js';
import { F03PublicAssistantGateway } from '../../backend/dist/modules/busqueda/infrastructure/public-assistant-gateway.js';
import { SearchPublicOffers } from '../../backend/dist/modules/busqueda/application/search-public-offers.js';
import { F03PublicKnowledgeTools } from '../../backend/dist/modules/asistente-ia/infrastructure/public-knowledge-tools.js';
import { QueryAssistant } from '../../backend/dist/modules/asistente-ia/application/query-assistant.js';
import { MockAIProvider } from '../../backend/dist/modules/asistente-ia/infrastructure/mock-ai-provider.js';
import { createAssistantRouter } from '../../backend/dist/modules/asistente-ia/presentation/assistant-router.js';

if (process.env.F061_E2E_LOCAL !== '1') throw new Error('Harness F06.1 solo TEST explícito');
let offsetMs = 0;
const offer = { medicamento: { id: '00000000-0000-4000-8000-000000000001', nombreComercial: 'Producto ficticio',
  principioActivo: 'compuesto ficticio', concentracion: '10 mg', presentacion: 'tabletas', clasificacion: 'venta libre' },
farmacia: { id: '00000000-0000-4000-8000-000000000002', nombre: 'Farmacia Alfa TEST', direccion: 'Calle TEST' },
precioReferencialCentavos: 1200, disponibilidadReferencial: 'DISPONIBLE',
ultimaRevision: '2026-11-17T00:00:00.000Z', distanciaKm: null };
const repository = { search: async query => query.term.includes('ficticio') ? [offer] : [],
  pharmacy: async id => id === offer.farmacia.id ? offer.farmacia : null };
const gateway = new F03PublicAssistantGateway(new SearchPublicOffers(repository, null,
  { ttlSeconds: 30, candidateLimit: 200 }), repository);
const mock = new MockConversationProvider();
const provider = { classify: query => query === 'Simular fallo técnico TEST'
  ? Promise.reject(new Error('TEST_ONLY_PROVIDER_FAILURE')) : mock.classify(query) };
const assistant = new ConverseAssistant(provider, new InMemoryReviewedSourceCatalog([]),
  new F03ConversationPublicTools(gateway), new InMemoryConversationStore(() => Date.now() + offsetMs));
const app = express();
app.get('/health', (_request, response) => response.status(200).json({ status: 'ok' }));
app.post('/api/v1/__test/clock/advance', express.json(), (request, response) => {
  if (request.ip !== '127.0.0.1' || request.body?.milliseconds !== 900_001) return response.sendStatus(400);
  offsetMs += 900_001;
  return response.sendStatus(204);
});
app.use('/api/v1', createAssistantRouter(new QueryAssistant(new MockAIProvider(),
  new F03PublicKnowledgeTools(gateway))));
app.use('/api/v1', createConversationRouter(assistant));
const server = app.listen(3000, '127.0.0.1', () => console.log('F06.1 browser TEST API lista'));
process.on('SIGTERM', () => server.close());
