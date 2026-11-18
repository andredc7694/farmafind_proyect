function messageFor(status) {
  if (status === 429) return 'Has realizado demasiadas consultas. Espera un momento.';
  if (status === 422) return 'La conversación venció o no está disponible. Inicia una nueva.';
  if (status === 400 || status === 413) return 'Revisa la consulta antes de enviarla.';
  return 'El asistente no está disponible temporalmente. Puedes usar la búsqueda pública.';
}

export class ConversationClientError extends Error {
  constructor(status) { super(messageFor(status)); this.status = status; }
}

export function createConversationClient(fetchImpl = fetch) {
  return {
    async query(consulta, conversacionId) {
      const response = await fetchImpl('/api/v1/asistente/conversaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(conversacionId ? { consulta, conversacionId } : { consulta }),
      });
      if (!response.ok) throw new ConversationClientError(response.status);
      return response.json();
    },
    async discard(conversacionId) {
      if (!conversacionId) return;
      const response = await fetchImpl('/api/v1/asistente/conversaciones/descartar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversacionId }),
      });
      if (!response.ok) throw new ConversationClientError(response.status);
    },
  };
}
