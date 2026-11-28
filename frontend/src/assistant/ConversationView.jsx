import React, { useState } from 'react';
import { createConversationClient } from './conversation-client.js';
import { AssistantCards } from './ChatBubble.jsx';

/** Página del asistente (F06.1, contrato 2.0 de F06.2): la conversación vive solo en la memoria de esta página. */
export function ConversationView({ client = createConversationClient() }) {
  const [query, setQuery] = useState('');
  const [context, setContext] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [answers, setAnswers] = useState([]);

  async function submit(event) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await client.query(query, context);
      setAnswers(previous => [...previous, result]);
      setContext(result.contexto ?? {});
      setQuery('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la consulta.');
    } finally { setBusy(false); }
  }

  function discard() { setContext({}); setAnswers([]); setQuery(''); setError(''); }

  return <main className="bootstrap search assistant" aria-labelledby="conversation-title">
    <p className="eyebrow">FarmaFind AI</p><h1 id="conversation-title">Asistente conversacional informativo</h1>
    <p>Información educativa fundamentada. No ofrece diagnósticos, tratamientos personales, recetas ni dosis.</p>
    <p>Las fichas de medicamentos reales aún no están habilitadas. Puedes consultar <a href="/search">la búsqueda pública</a>.</p>
    <div className="conversation-log" aria-live="polite">{answers.map((answer, index) => <section key={index} className="offer conversation-answer" aria-label={`Respuesta ${index + 1}`}>
      <p>{answer.respuesta}</p>
      {answer.tarjetas?.length > 0 && <AssistantCards cards={answer.tarjetas} />}
      <p className="notice">{answer.aviso}</p>
      {answer.fuentes?.length > 0 && <><h2>Fuentes</h2><ul>{answer.fuentes.map((source, sourceIndex) =>
        <li key={`${source.referencia}-${sourceIndex}`}>{source.titulo} · {source.referencia} · revisado {source.revisadoEl}</li>)}</ul></>}
    </section>)}</div>
    <form onSubmit={submit} className="search-form">
      <label htmlFor="conversation-query">¿Qué información deseas consultar?</label>
      <textarea id="conversation-query" value={query} maxLength="500" rows="4" required onChange={event => setQuery(event.target.value)} />
      <p>{query.length}/500 caracteres</p>
      <button type="submit" disabled={busy}>{busy ? 'Consultando…' : 'Consultar'}</button>
    </form>
    {busy && <p role="status">Procesando consulta…</p>}
    {error && <p role="alert">{error} <a href="/search">Ir a búsqueda pública</a></p>}
    <button type="button" onClick={discard} disabled={busy || answers.length === 0}>Descartar conversación</button>
  </main>;
}
