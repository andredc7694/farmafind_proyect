import React, { useEffect, useId, useRef, useState } from 'react';

/**
 * Campo con sugerencias (patrón combobox WAI-ARIA). Solo PROPONE texto: elegir una sugerencia rellena el campo y no ejecuta
 * ninguna acción. Funciona sin sugerencias (el servidor puede fallar) y con teclado: ↑ ↓ Enter Esc.
 */
export function SuggestBox({ id = 'public-query', label, value, onChange, suggest, delayMs = 250, minLength = 2, required = false }) {
  const listId = useId(); const [items, setItems] = useState([]); const [open, setOpen] = useState(false); const [active, setActive] = useState(-1);
  const latest = useRef(0); const skip = useRef(false);

  useEffect(() => {
    if (skip.current) { skip.current = false; return undefined; }
    const text = value.trim();
    if (!suggest || text.length < minLength) { setItems([]); setOpen(false); return undefined; }
    const ticket = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const found = await suggest(text);
        if (ticket !== latest.current) return; // respuesta vieja: se descarta
        setItems(found.slice(0, 8)); setActive(-1); setOpen(found.length > 0);
      } catch { if (ticket === latest.current) { setItems([]); setOpen(false); } }
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, suggest, delayMs, minLength]);

  function choose(index) { const item = items[index]; if (!item) return; skip.current = true; onChange(item.text); setOpen(false); setActive(-1); }
  function keyDown(event) {
    if (event.key === 'ArrowDown') { event.preventDefault(); if (items.length) { setOpen(true); setActive(current => (current + 1) % items.length); } }
    else if (event.key === 'ArrowUp') { event.preventDefault(); if (items.length) { setOpen(true); setActive(current => (current <= 0 ? items.length - 1 : current - 1)); } }
    else if (event.key === 'Enter' && open && active >= 0) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape' && open) { event.preventDefault(); setOpen(false); setActive(-1); }
  }

  return <div className="suggest-box">
    <label htmlFor={id}>{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId} aria-haspopup="listbox"
      aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} autoComplete="off" required={required} minLength={2} maxLength={120}
      value={value} onChange={event => { onChange(event.target.value); }} onKeyDown={keyDown} onBlur={() => setTimeout(() => setOpen(false), 120)} />
    <ul id={listId} role="listbox" aria-label="Sugerencias" hidden={!open}>{items.map((item, index) =>
      <li key={`${item.kind}-${item.text}`} id={`${listId}-${index}`} role="option" aria-selected={index === active}
        onMouseDown={event => { event.preventDefault(); choose(index); }}>{item.text}<small> · {item.kind === 'NOMBRE' ? 'nombre' : 'presentación'}</small></li>)}</ul>
    <p className="visually-hidden" role="status" aria-live="polite">{open ? `${items.length} sugerencias disponibles` : ''}</p>
  </div>;
}
