import React,{useState} from 'react';
import { createAssistantClient } from './assistant-client.js';

export function AssistantView({client=createAssistantClient()}) {
  const [consulta,setConsulta]=useState(''); const [status,setStatus]=useState('idle');
  const [result,setResult]=useState(null); const [message,setMessage]=useState('');
  async function submit(event) {
    event.preventDefault(); setStatus('loading'); setMessage(''); setResult(null);
    try { setResult(await client.query(consulta)); setStatus('ready'); }
    catch(error) { setMessage(error instanceof Error?error.message:'No fue posible completar la consulta.'); setStatus('error'); }
  }
  return <main className="bootstrap search assistant" aria-labelledby="assistant-title">
    <p className="eyebrow">FarmaFind AI</p><h1 id="assistant-title">Asistente informativo</h1>
    <p>Busca y compara información pública de FarmaFind. No brinda diagnósticos, recetas ni dosis.</p>
    <p><a href="/assistant/conversation">Abrir el asistente conversacional</a></p>
    <form onSubmit={submit} className="search-form">
      <label htmlFor="assistant-query">¿Qué información deseas consultar?</label>
      <textarea id="assistant-query" required maxLength="500" rows="4" value={consulta} onChange={event=>setConsulta(event.target.value)} />
      <p>{consulta.length}/500 caracteres</p>
      <button type="submit" disabled={status==='loading'}>{status==='loading'?'Consultando…':'Consultar'}</button>
    </form>
    {message&&<p role="alert">{message}</p>}
    {result&&<section aria-live="polite" aria-labelledby="assistant-answer"><h2 id="assistant-answer">Respuesta</h2>
      <p>{result.respuesta}</p><p className="notice">{result.aviso}</p>
      {result.fuentes.length>0&&<><h3>Fuentes públicas</h3><ul className="offer-grid">{result.fuentes.map((source,index)=>
        <li className="offer" key={`${source.tipo}-${index}`}>{source.tipo==='OFERTA'?<>
          <strong>{source.oferta.medicamento.nombreComercial}</strong><p>{source.oferta.medicamento.principioActivo} · {source.oferta.medicamento.concentracion}</p>
          <p>{source.oferta.farmacia.nombre} · S/ {(source.oferta.precioReferencialCentavos/100).toFixed(2)}</p>
        </>:<strong>{source.farmacia.nombre}</strong>}</li>)}</ul></>}
    </section>}
  </main>;
}
