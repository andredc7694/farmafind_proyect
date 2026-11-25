import React, { useEffect, useId, useRef, useState } from 'react';
import { ConversationClientError, createConversationClient } from './conversation-client.js';
import { bubbleHiddenOn, suggestedQuestions } from './chat-suggestions.js';

const defaultClient = createConversationClient();

/**
 * Burbuja flotante del asistente (F06.1 en modo mock). Minimizable, sin tapar el contenido (el contenido se desplaza y la
 * burbuja se ancla al costado o abajo), con foco gestionado y conversación solo en memoria de la pestaña. Solo LEE.
 */
export function ChatBubble({ client = defaultClient, path = typeof window === 'undefined' ? '/' : window.location.pathname }) {
  const panelId = useId(); const buttonRef = useRef(null); const fieldRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hidden = bubbleHiddenOn(path);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.setAttribute('data-chat', open ? 'open' : 'closed');
    return () => document.body.removeAttribute('data-chat');
  }, [open]);
  useEffect(() => { if (open) fieldRef.current?.focus(); }, [open]);
  useEffect(() => { // Escape minimiza aunque el foco se haya perdido (p. ej. tras enviar y deshabilitarse el botón)
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (hidden) return null;
  const close = () => { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0); };

  async function submit(event) {
    event.preventDefault();
    if (!query.trim() || busy) return;
    setBusy(true); setError('');
    try {
      const result = await client.query(query, conversationId);
      setAnswers(previous => [...previous, { question: query, ...result }]); setConversationId(result.conversacionId ?? null); setQuery('');
    } catch (cause) {
      if (cause instanceof ConversationClientError && cause.status === 422) setConversationId(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la consulta.');
    } finally { setBusy(false); }
  }
  async function discard() {
    setBusy(true); setError('');
    try { await client.discard(conversationId); setConversationId(null); setAnswers([]); setQuery(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo descartar la conversación.'); }
    finally { setBusy(false); }
  }

  return <div className="chat-bubble">
    {open && <section id={panelId} className="chat-panel" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}>
      <header>
        <h2 id={`${panelId}-title`}>FarmaFind AI</h2>
        <button type="button" onClick={close} aria-label="Minimizar el asistente">Minimizar</button>
      </header>
      <p className="chat-note">Información educativa y datos públicos de ofertas. No da diagnósticos, tratamientos, recetas ni dosis.</p>
      <div className="chat-log" aria-live="polite">{answers.map((answer, index) => <article key={index} className="chat-answer" aria-label={`Respuesta ${index + 1}`}>
        <p className="chat-question">{answer.question}</p><p>{answer.respuesta}</p>
        {answer.fuentes?.length > 0 && <ul className="chat-sources" aria-label="Fuentes">{answer.fuentes.map((source, i) =>
          <li key={`${source.referencia}-${i}`}>{source.titulo} · {source.referencia} · revisado {source.revisadoEl}</li>)}</ul>}
        {answer.aviso && <small>{answer.aviso}</small>}
      </article>)}</div>
      {answers.length === 0 && <div className="chat-suggestions"><p>Preguntas sugeridas (solo rellenan el campo):</p>
        <ul>{suggestedQuestions(path).map(text => <li key={text}><button type="button" onClick={() => { setQuery(text); fieldRef.current?.focus(); }}>{text}</button></li>)}</ul></div>}
      <form onSubmit={submit}>
        <label htmlFor={`${panelId}-q`}>Tu consulta</label>
        <textarea id={`${panelId}-q`} ref={fieldRef} value={query} maxLength="500" rows="3" required onChange={event => setQuery(event.target.value)} />
        <div className="chat-actions">
          <button type="submit" disabled={busy}>{busy ? 'Consultando…' : 'Enviar'}</button>
          <button type="button" onClick={discard} disabled={busy || (!conversationId && answers.length === 0)}>Descartar conversación</button>
        </div>
      </form>
      {busy && <p role="status">Procesando consulta…</p>}
      {error && <p role="alert">{error} <a href="/search">Ir a búsqueda pública</a></p>}
    </section>}
    {!open && <button ref={buttonRef} type="button" className="chat-toggle" aria-expanded="false" aria-controls={panelId} onClick={() => setOpen(true)}>
      Preguntar a FarmaFind AI{answers.length > 0 ? ` (${answers.length})` : ''}</button>}
  </div>;
}
