import React, { useEffect, useState } from 'react';
import { createLocationAdminClient } from './location-admin-client.js';
import { PointPicker } from './PointPicker.jsx';

/** Presentation visibility follows F01 capabilities; every write is reauthorized by F07/RLS. */
export function LocationAdmin({pharmacyId,delegationCodes=[],client=createLocationAdminClient()}) {
  const canPropose=delegationCodes.includes('GEO_LOCATION_PROPOSE');
  const canReview=delegationCodes.includes('GEO_LOCATION_REVIEW');
  const [status,setStatus]=useState('');
  const [statusKind,setStatusKind]=useState('status');
  const [proposalId,setProposalId]=useState('');
  const [busy,setBusy]=useState(false);
  const [latitude,setLatitude]=useState('');
  const [longitude,setLongitude]=useState('');
  const point=latitude!==''&&longitude!==''?{latitude:Number(latitude),longitude:Number(longitude)}:null;
  useEffect(()=>{setProposalId('');setStatus('');setStatusKind('status');setLatitude('');setLongitude('');},[pharmacyId]);
  if(!pharmacyId||(!canPropose&&!canReview))return null;
  async function perform(action) {
    setBusy(true);setStatus('');
    try {const result=await action();setProposalId(result.id);setStatusKind('status');setStatus(result.estado==='PENDIENTE'
      ? 'Propuesta registrada; requiere revisión por otra persona autorizada.'
      : `Revisión registrada: ${result.estado}.`);}
    catch(error){setStatusKind('alert');setStatus(error.message);}
    finally{setBusy(false);}
  }
  return <section aria-labelledby="location-admin-title">
    <h2 id="location-admin-title">Ubicación pública de la farmacia</h2>
    <p className="notice">Operación disponible únicamente en el entorno TEST/DEMO autorizado.</p>
    <p>Los cambios requieren evidencia y revisión por otra persona autorizada de esta farmacia.</p>
    {status&&<p role={statusKind}>{status}</p>}
    {canPropose&&<form className="surface-card" onSubmit={event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      void perform(()=>client.propose(pharmacyId,{
        direccionPublicable:String(data.get('direccionPublicable')),
        ciudad:String(data.get('ciudad')),latitud:Number(data.get('latitud')),
        longitud:Number(data.get('longitud')),fuente:String(data.get('fuente')),
        evidenciaReferencia:String(data.get('evidenciaReferencia')),
      }));
    }}>
      <h3>Proponer ubicación</h3>
      <label>Dirección pública <input name="direccionPublicable" required maxLength={240} /></label>
      <label>Ciudad <input name="ciudad" required minLength={2} maxLength={120} /></label>
      <PointPicker value={point} onChange={next=>{setLatitude(String(next.latitude));setLongitude(String(next.longitude));}} />
      <label>Latitud <input name="latitud" required type="number" step="any" min="-90" max="90" value={latitude} onChange={event=>setLatitude(event.target.value)} /></label>
      <label>Longitud <input name="longitud" required type="number" step="any" min="-180" max="180" value={longitude} onChange={event=>setLongitude(event.target.value)} /></label>
      <label><input name="confirmaDireccion" type="checkbox" required /> Confirmo que la dirección pública y el punto elegido son correctos</label>
      <label>Fuente <input name="fuente" required minLength={2} maxLength={120} /></label>
      <label>Referencia de evidencia no sensible <input name="evidenciaReferencia" required maxLength={240} /></label>
      <button disabled={busy}>Enviar propuesta</button>
    </form>}
    {canReview&&<form className="surface-card" onSubmit={event=>{
      event.preventDefault();const data=new FormData(event.currentTarget);
      void perform(()=>client.review(pharmacyId,String(data.get('propuestaId')),
        {decision:String(data.get('decision')),evidenciaConfirmada:data.get('evidenciaConfirmada')==='on',
          motivo:String(data.get('motivo'))}));
    }}>
      <h3>Revisar propuesta ajena</h3>
      <label>ID de propuesta <input name="propuestaId" required value={proposalId}
        onChange={event=>setProposalId(event.target.value)} /></label>
      <label>Decisión <select name="decision"><option value="APROBAR">Aprobar</option>
        <option value="RECHAZAR">Rechazar</option></select></label>
      <label><input name="evidenciaConfirmada" type="checkbox" /> Evidencia comprobada</label>
      <label>Motivo <input name="motivo" maxLength={500} required /></label>
      <button disabled={busy}>Registrar revisión</button>
    </form>}
  </section>;
}
