import React, { useEffect, useId, useRef, useState } from 'react';
import { createConversationClient } from './conversation-client.js';
import { QUICK_QUESTIONS, bubbleHiddenOn, readMinimized, writeMinimized } from './chat-suggestions.js';
import { placeForAssistant, readSearchContext, subscribeSearchContext } from '../search/search-context.js';

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
const soles = cents => `S/ ${(cents / 100).toFixed(2)}`;
const km = value => `${value.toLocaleString('es-PE', { maximumFractionDigits: 1 })} km`;

function Sources({ sources }) {
  if (!sources?.length) return null;
  return <details className="chat-sources"><summary>Fuentes ({sources.length})</summary>
    <ul aria-label="Fuentes">{sources.map((source, i) =>
      <li key={`${source.referencia}-${i}`}>{source.titulo} · {source.referencia} · revisado {source.revisadoEl}</li>)}</ul></details>;
}

/** D-08: bloque de emergencia, siempre solo (nunca con tarjetas ni botones de producto). */
function Emergency({ notice }) {
  return <section className="chat-emergency" aria-label="Emergencia">
    <p><strong>{notice.mensaje}</strong></p>
    <ul className="chat-emergency-numbers">{notice.numeros.map(item => <li key={item.numero}>
      <a href={`tel:${item.numero}`}>Llamar al {item.numero} · {item.servicio}</a></li>)}</ul>
    <p className="chat-emergency-source">Fuente: {notice.fuentes.map((source, i) => <React.Fragment key={source.url}>
      {i > 0 && ' · '}<a href={source.url} target="_blank" rel="noreferrer">{source.titulo}</a></React.Fragment>)} (verificado el {notice.verificadoEl}).</p>
  </section>;
}

/** FR-005: hasta 3 tarjetas compactas; el texto de cada una se lee completo con lector de pantalla. */
export function AssistantCards({ cards }) {
  return <ul className="chat-cards" aria-label="Resultados">{cards.map(card => {
    const product = card.producto;
    return <li key={`${card.farmacia.id}-${product?.id ?? 'farmacia'}`} className="chat-card">
      {card.etiqueta && <p className="chat-card-label">{card.etiqueta}</p>}
      {product && <p className="chat-card-product"><strong>{product.nombre}</strong> {product.concentracion} · {product.presentacion}</p>}
      <p className="chat-card-pharmacy">{card.farmacia.nombre}<span className="chat-card-address"> · {card.farmacia.direccion}</span></p>
      <p className="chat-card-facts">
        {card.precioCentavos !== null && <span className="chat-card-price">{soles(card.precioCentavos)}</span>}
        {card.distanciaKm !== null && <span>a {km(card.distanciaKm)}</span>}
        {card.horarioHoy && <span>{card.horarioHoy}</span>}
      </p>
      {card.reservarUrl && <a className="chat-card-action" href={card.reservarUrl}
        aria-label={`Reservar ${product?.nombre ?? ''} en ${card.farmacia.nombre}`}>Reservar</a>}
    </li>;
  })}</ul>;
}

/**
 * F06.2: asistente en panel lateral (computadora) u hoja inferior (celular). La conversación vive solo en la memoria
 * de esta pestaña (D-01): recargar o cerrar la borra. Solo LEE; «Reservar» lleva a la pantalla de reserva existente.
 */
export function ChatBubble({ client = defaultClient, path = typeof window === 'undefined' ? '/' : window.location.pathname }) {
  const panelId = useId(); const buttonRef = useRef(null); const fieldRef = useRef(null); const logRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [minimizedBefore, setMinimizedBefore] = useState(() => readMinimized());
  const [query, setQuery] = useState('');
  const [answers, setAnswers] = useState([]);
  const [context, setContext] = useState({});
  const [pending, setPending] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [screen, setScreen] = useState(() => readSearchContext());
  const hidden = bubbleHiddenOn(path);
  const onSearch = /^\/search/.test(path) && screen.term !== '';

  useEffect(() => subscribeSearchContext(setScreen), []);
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.setAttribute('data-chat', open ? 'open' : 'closed');
    return () => document.body.removeAttribute('data-chat');
  }, [open]);
  useEffect(() => { if (open) fieldRef.current?.focus(); }, [open]);
  useEffect(() => { // Escape minimiza aunque el foco se haya perdido
    if (!open) return undefined;
    const onKey = event => { if (event.key === 'Escape') minimize(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);
  useEffect(() => {
    const show = () => expand();
    window.addEventListener(OPEN_CHAT_EVENT, show);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, show);
  }, []);
  useEffect(() => { const log = logRef.current; if (log) log.scrollTop = log.scrollHeight; }, [open, answers, pending, error]);

  if (hidden) return null;
  function expand() { setOpen(true); writeMinimized(false); setMinimizedBefore(false); }
  function minimize() { setOpen(false); writeMinimized(true); setMinimizedBefore(true); setTimeout(() => buttonRef.current?.focus(), 0); }

  async function send(text = query.trim()) {
    if (!text || busy) return;
    // El lugar elegido en «Buscar medicamentos» completa el contexto si la conversación aún no tiene uno.
    const outgoing = context.distrito || context.punto ? context : { ...context, ...placeForAssistant(screen.place) };
    setBusy(true); setError(''); setPending(text); setQuery('');
    try {
      const result = await client.query(text, outgoing);
      setAnswers(previous => [...previous, { question: text, ...result }]);
      setContext(result.contexto ?? {});
    } catch (cause) {
      setQuery(text); // no se pierde lo escrito
      setError(cause instanceof Error ? cause.message : 'No se pudo completar la consulta.');
    } finally { setPending(null); setBusy(false); fieldRef.current?.focus(); }
  }
  function restart() { setAnswers([]); setContext({}); setQuery(''); setError(''); fieldRef.current?.focus(); }
  function fill(text) {
    setQuery(text);
    const field = fieldRef.current;
    if (field) { field.focus(); setTimeout(() => field.setSelectionRange(text.length, text.length), 0); }
  }
  const quick = item => (item.send ? send(item.send) : fill(item.fill));
  const proposal = onSearch ? { texto: '¿Quieres ver el más barato cerca de ti?', consulta: `${screen.term} cerca` } : null;
  const toggleLabel = `Preguntar a FarmaFind AI${answers.length > 0 ? ` (${answers.length})` : ''}`;

  return <div className="chat-bubble">
    {open && <section id={panelId} className="chat-panel" role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}>
      <header className="chat-header">
        <span className="chat-avatar"><Icon path={chatIcon} /></span>
        <h2 id={`${panelId}-title`}>FarmaFind AI</h2>
        <button type="button" className="chat-icon" onClick={restart} disabled={busy || answers.length === 0}
          aria-label="Nueva conversación" title="Nueva conversación"><Icon path={restartIcon} /></button>
        <button type="button" className="chat-icon chat-minimize" onClick={minimize} aria-label="Minimizar el asistente" title="Minimizar">
          <Icon path={minimizeIcon} /><span className="chat-minimize-label">Minimizar</span></button>
      </header>
      <div className="chat-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversación" tabIndex={0}>
        <div className="chat-message chat-assistant">
          <p>¡Hola! Puedo comparar precios referenciales, buscar farmacias cercanas o abiertas ahora y mostrarte productos con el mismo principio activo.</p>
          <ul className="chat-suggestions" aria-label="Preguntas rápidas">{QUICK_QUESTIONS.map(item => <li key={item.label}>
            <button type="button" onClick={() => quick(item)} disabled={busy && Boolean(item.send)}>{item.label}</button></li>)}</ul>
          {proposal && <p><button type="button" className="chat-proposal" onClick={() => send(proposal.consulta)} disabled={busy}>{proposal.texto}</button></p>}
        </div>
        {answers.map((answer, index) => <article key={index} className="chat-answer" aria-label={`Respuesta ${index + 1}`}>
          <div className="chat-message chat-user"><span className="visually-hidden">Tú: </span><p>{answer.question}</p></div>
          <div className="chat-message chat-assistant"><span className="visually-hidden">Asistente: </span>
            {answer.emergencia ? <Emergency notice={answer.emergencia} /> : <>
              <p>{answer.respuesta}</p>
              {answer.tarjetas?.length > 0 && <AssistantCards cards={answer.tarjetas} />}
              {answer.opciones?.length > 0 && <ul className="chat-options" aria-label="Elige una opción">{answer.opciones.map(option =>
                <li key={option.consulta}><button type="button" onClick={() => send(option.consulta)} disabled={busy}>{option.texto}</button></li>)}</ul>}
              {answer.sugerencia && <p><button type="button" className="chat-proposal" onClick={() => send(answer.sugerencia.consulta)} disabled={busy}>{answer.sugerencia.texto}</button></p>}
              {answer.verTodas && <p><a href={answer.verTodas.url}>{answer.verTodas.texto}</a></p>}
              {answer.respuesta.includes('Ver farmacias en el mapa') && <p><a href="/search/mapa">Ver farmacias en el mapa</a></p>}
              <Sources sources={answer.fuentes} />
            </>}
          </div>
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
      <p className="chat-note">No da diagnósticos, tratamientos ni dosis: consulta al químico farmacéutico. Emergencias: SAMU 106. Precios y disponibilidad referenciales. Al recargar, la conversación se borra.</p>
    </section>}
    {!open && <button ref={buttonRef} type="button" className="chat-toggle" aria-expanded="false" aria-controls={panelId} onClick={expand}
      aria-label={toggleLabel}>
      <Icon path={chatIcon} /> <span className="chat-toggle-label">{onSearch && !minimizedBefore && answers.length === 0
        ? '¿Quieres ver el más barato cerca de ti?' : toggleLabel}</span></button>}
  </div>;
}
