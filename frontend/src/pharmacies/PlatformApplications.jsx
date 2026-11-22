import React,{useEffect,useState} from 'react';
import {createPharmacyApplicationClient} from './application-client.js';

const client=createPharmacyApplicationClient();
const actionsByState={
  PENDIENTE:['INICIAR_REVISION'],
  EN_REVISION:['OBSERVAR','RECHAZAR','APROBAR'],
};
export function PlatformApplications(){
  const [items,setItems]=useState([]);const [detail,setDetail]=useState(null);
  const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
  const [listStatus,setListStatus]=useState('loading');
  const [detailStatus,setDetailStatus]=useState('idle');
  const [reason,setReason]=useState('');
  async function reload(){
    setListStatus('loading');
    try{setItems(await client.listForReview());setListStatus('ready');}
    catch(error){setItems([]);setListStatus(error?.message?.includes('permiso')?'denied':'error');throw error;}
  }
  useEffect(()=>{reload().catch(error=>setMessage(error.message));},[]);
  async function openDetail(id){
    setDetail(null);setDetailStatus('loading');setMessage('');
    try{setDetail(await client.detailForReview(id));setDetailStatus('ready');}
    catch(error){setDetailStatus('error');setMessage(error?.message||'No se pudo abrir la solicitud.');}
  }
  async function action(work){setBusy(true);setMessage('');try{
    await work();await reload();setDetail(null);setReason('');setMessage('Decisión registrada en TEST.');
  }catch(error){setMessage(error.message||'No se pudo completar la solicitud.');}
  finally{setBusy(false);}}
  return <main className="page-stack"><h1>Solicitudes de farmacias</h1>
    <p>Panel TEST para revisores autorizados. No concede acceso a inventarios privados.</p>
    {message&&<p role="alert">{message}</p>}
    <section className="card"><h2>Solicitudes</h2>
      {listStatus==='loading'&&<p role="status">Cargando solicitudes…</p>}
      {listStatus==='ready'&&!items.length&&<p>No hay solicitudes visibles.</p>}
      {listStatus==='denied'&&<p role="status">Tu cuenta no tiene permiso para revisar solicitudes.</p>}
      {listStatus==='error'&&<p role="status">No se pudo cargar la lista. Comprueba la conexión.</p>}
      <ul>{items.map(item=><li key={item.id}>
        <button type="button" disabled={detailStatus==='loading'} onClick={()=>void openDetail(item.id)}>
          {item.nombreComercial} · {item.estado}</button>
      </li>)}</ul></section>
    {detailStatus==='loading'&&<p role="status">Cargando solicitud…</p>}
    {detail&&<section className="card"><h2>{detail.nombreComercial}</h2>
      <p>Estado: {detail.estado}. Contacto: {detail.contacto}. Ubicación: {detail.direccion}, {detail.distrito}.</p>
      <label>Motivo de la decisión<input value={reason} minLength={8} maxLength={500}
        onChange={event=>setReason(event.target.value)}/></label>
      {(actionsByState[detail.estado]??[]).map(accion=><button type="button"
        key={accion} disabled={busy||reason.trim().length<8}
        onClick={()=>void action(()=>client.decide(detail.id,accion,detail.version,reason))}>{accion.replace('_',' ')}</button>)}
      {!actionsByState[detail.estado]&&<p role="status">Esta solicitud no admite nuevas decisiones desde el panel.</p>}
    </section>}
  </main>;
}
