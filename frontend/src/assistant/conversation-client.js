function messageFor(status) {
  if (status === 429) return 'Has realizado demasiadas consultas. Espera un momento.';
  if (status === 400 || status === 413) return 'Revisa la consulta antes de enviarla.';
  return 'El asistente no está disponible temporalmente. Puedes usar la búsqueda pública.';
}

export class ConversationClientError extends Error {
  constructor(status) { super(messageFor(status)); this.status = status; }
}

/**
 * F06.2 · contrato 2.0: el servidor no guarda la conversación. La página envía, junto con la pregunta, el último
 * `contexto` estructurado que el propio servidor devolvió (medicamento, concentración, forma, distrito…), nunca el
 * texto de la conversación. Vive solo en la memoria de la pestaña.
 */
export function createConversationClient(fetchImpl = fetch) {
  return {
    async query(consulta, contexto) {
      const hasContext = contexto && typeof contexto === 'object' && Object.keys(contexto).length > 0;
      const response = await fetchImpl('/api/v1/asistente/conversaciones', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasContext ? { consulta, contexto } : { consulta }),
      });
      if (!response.ok) throw new ConversationClientError(response.status);
      return response.json();
    },
  };
}
