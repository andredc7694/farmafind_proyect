import React from 'react';

const destinations = [
  { number: '01', label: 'Busca con claridad', description: 'Consulta productos publicados y compara información referencial de las farmacias.', href: '/search', action: 'Explorar búsqueda' },
  { number: '02', label: 'Encuentra una farmacia', description: 'Explora farmacias por ciudad en la demostración local. Comparte tu ubicación solo si decides hacerlo.', href: '/search/mapa', action: 'Ver farmacias' },
  { number: '03', label: 'Pregunta al asistente', description: 'Recibe orientación informativa basada en datos públicos, con límites clínicos claros.', href: '/assistant/conversation', action: 'Abrir FarmaFind AI' },
];

export function Home() {
  return <main className="home-page">
    <section className="hero" aria-labelledby="home-title">
      <div className="hero-content">
        <p className="eyebrow"><span className="eyebrow-dot" /> Información farmacéutica a tu alcance</p>
        <h1 id="home-title">Encuentra información para <em>decidir con claridad.</em></h1>
        <p className="hero-lead">Busca medicamentos publicados, compara opciones referenciales y encuentra farmacias desde un solo lugar.</p>
        <div className="hero-actions"><a className="button button-primary" href="/search">Buscar medicamentos <span aria-hidden="true">↗</span></a><a className="button button-outline" href="/search/mapa">Explorar farmacias</a></div>
        <p className="hero-note">Información pública y referencial. Confirma disponibilidad y precio directamente con la farmacia.</p>
      </div>
      <div className="hero-art" aria-hidden="true"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-center"><span>✚</span><small>farmafind</small></div><span className="hero-chip chip-one">Búsqueda clara</span><span className="hero-chip chip-two">Farmacias cerca</span></div>
    </section>

    <section className="section-width pathways" aria-labelledby="pathways-title">
      <div className="section-heading"><div><p className="eyebrow">Un camino sencillo</p><h2 id="pathways-title">¿Qué necesitas hacer hoy?</h2></div><p>Elige por dónde comenzar. Cada resultado proviene de información pública autorizada.</p></div>
      <div className="pathway-grid">{destinations.map(item => <article className="pathway-card" key={item.number}><span className="pathway-number">{item.number}</span><h3>{item.label}</h3><p>{item.description}</p><a href={item.href}>{item.action} <span aria-hidden="true">↗</span></a></article>)}</div>
    </section>

    <section className="section-width trust-band" aria-labelledby="trust-title"><div className="trust-icon" aria-hidden="true">✓</div><div><p className="eyebrow">Información responsable</p><h2 id="trust-title">Transparencia en cada consulta</h2><p>Los resultados muestran únicamente datos publicados y autorizados. FarmaFind AI no diagnostica, prescribe ni recomienda dosis.</p></div><a className="button button-light" href="/assistant">Conocer el asistente</a></section>

    <section className="bootstrap-check" aria-label="Comprobación técnica F00"><h2>FarmaFind — Bootstrap</h2><p>Modo técnico: sin funcionalidades de negocio</p><p>Frontend React y Vite disponible en el entorno local.</p></section>
  </main>;
}
