import React, { useEffect, useId, useRef, useState } from 'react';
import { ConversationClientError, createConversationClient } from './conversation-client.js';
import { SUGGESTIONS, bubbleHiddenOn } from './chat-suggestions.js';

const defaultClient = createConversationClient();
export const OPEN_CHAT_EVENT = 'farmafind:open-chat';
const isTouch = () => typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;

/** Enter envía en computadora; Shift+Enter y las pantallas táctiles hacen salto de línea. No corta la composición (IME). */
export function sendsWithEnter(event, touch = isTouch()) {
  return event.key === 'Enter' && !event.shiftKey && !touch && !event.nativeEvent?.isComposing && event.keyCode !== 229;
}

const Icon = ({ path }) => <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
  <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const chatIcon = 'M4 5h16v11H9l-5 4z';
const minimizeIcon = 'M5 18h14';
const restartIcon = 'M4 12a8 8 0 1 0 2.5-5.8M4 4v4h4';

function Sources({ sources }) {
  if (!sources?.length) return null;
  return <details className="chat-sources"><summary>Fuentes ({sources.length})</summary>
    <ul aria-label="Fuentes">{sources.map((source, i) =>
      <li key={`${source.referencia}-${i}`}>{source.titulo} · {source.referencia} · revisado {source.revisadoEl}</li>)}</ul></details>;
}

/**
 * Asistente flotante (F06.1 en modo mock): conversación solo en memoria de la pestaña, foco gestionado y solo LEE.
 */
export function ChatBubble({ client = defaultClient, path = typeof window === 'undefined' ? '/' : window.location.pathname }) {
  const panelId = useId(); const buttonRef = useRef(null); const fieldRef = useRef(null); const logRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const hidden = bubbleHiddenOn(path);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.setAttribute('data-chat', open ? 'open' : 'closed');
    return () => document.body.removeAttribute('data-chat');
  }, [open]);
  useEffect(() => { if (open) fieldRef.current?.focus(); }, [open]);
  useEffect(() => { // Escape minimiza aunque el foco se haya perdido
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, show);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, show);
  }, []);
  useEffect(() => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; }, [open, answers, pending, error]);

  if (hidden) return null;
  const close = () => { setOpen(false); setTimeout(() => buttonRef.current?.focus(), 0); };

  async function send() {
    const text = query.trim();
    if (!text || busy) return;
    setBusy(true); setError(''); setPending(text); setQuery('');
    try {
      const result = await client.query(text, conversationId);
      setAnswers(previous => [...previous, { question: text, ...result }]); setConversationId(result.conversacionId ?? null);
    } catch (cause) {
      setQuery(text); // no se pierde lo escrito
      if (cause instanceof ConversationClientError && cause.status === 422) setConversationId(null);
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la consulta.');
    } finally { setPending(null); setBusy(false); fieldRef.current?.focus(); }
  }
  async function discard() {
    setBusy(true); setError('');
    try { await client.discard(conversationId); setConversationId(null); setAnswers([]); setQuery(''); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo descartar la conversación.'); }
    finally { setBusy(false); }
  }
  function suggest(fill) {
    setQuery(fill);
    const field = fieldRef.current;
    if (field) { field.focus(); setTimeout(() => field.setSelectionRange(fill.length, fill.length), 0); }
  }

  return <div className="chat-bubble">
    {open && <section id={panelId} className="chat-panel" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}>
      <header className="chat-header">
        <span className="chat-avatar"><Icon path={chatIcon} /></span>
        <h2 id={`${panelId}-title`}>FarmaFind AI</h2>
        <button type="button" className="chat-icon" onClick={discard} disabled={busy || (!conversationId && answers.length === 0)}
          aria-label="Descartar conversación" title="Descartar conversación"><Icon path={restartIcon} /></button>
        <button type="button" className="chat-icon" onClick={close} aria-label="Minimizar el asistente" title="Minimizar"><Icon path={minimizeIcon} /></button>
      </header>
      <div className="chat-log" ref={logRef} role="log" aria-label="Conversación" tabIndex={0}>
        <div className="chat-message chat-assistant">
          <p>¡Hola! Puedo ayudarte a comparar precios referenciales y a encontrar farmacias.</p>
          <ul className="chat-suggestions" aria-label="Preguntas sugeridas">{SUGGESTIONS.map(item => <li key={item.label}>
            <button type="button" onClick={() => suggest(item.fill)}>{item.label}</button></li>)}</ul>
        </div>
        {answers.map((answer, index) => <article key={index} className="chat-answer" aria-label={`Respuesta ${index + 1}`}>
          <div className="chat-message chat-user"><span className="visually-hidden">Tú: </span><p>{answer.question}</p></div>
          <div className="chat-message chat-assistant"><span className="visually-hidden">Asistente: </span><p>{answer.respuesta}</p>
            {answer.respuesta.includes('Ver farmacias en el mapa') && <p><a href="/search/mapa">Ver farmacias en el mapa</a></p>}
            <Sources sources={answer.fuentes} /></div>
        </article>)}
        {pending && <>
          <div className="chat-message chat-user"><span className="visually-hidden">Tú: </span><p>{pending}</p></div>
          <div className="chat-message chat-assistant chat-typing" role="status"><span className="visually-hidden">El asistente está escribiendo</span>
            <span aria-hidden="true">•</span><span aria-hidden="true">•</span><span aria-hidden="true">•</span></div>
        </>}
        {error && <p role="alert" className="chat-error">{error} <a href="/search">Ir a búsqueda pública</a></p>}
      </div>
      <form className="chat-form" onSubmit={event => { event.preventDefault(); void send(); }}>
        <label htmlFor={`${panelId}-q`} className="visually-hidden">Tu consulta</label>
        <textarea id={`${panelId}-q`} ref={fieldRef} value={query} maxLength="500" rows="2" required placeholder="Escribe tu consulta"
          onChange={event => setQuery(event.target.value)}
          onKeyDown={event => { if (sendsWithEnter(event)) { event.preventDefault(); void send(); } }} />
        <button type="submit" className="chat-send" disabled={busy}>Enviar</button>
      </form>
      <p className="chat-note">No da diagnósticos, tratamientos ni dosis: consulta al químico farmacéutico. Precios y disponibilidad referenciales.</p>
    </section>}
    {!open && <button ref={buttonRef} type="button" className="chat-toggle" aria-expanded="false" aria-controls={panelId} onClick={() => setOpen(true)}>
      <Icon path={chatIcon} /> Preguntar a FarmaFind AI{answers.length > 0 ? ` (${answers.length})` : ''}</button>}
  </div>;
}
