import React,{useEffect,useState} from 'react';
import {createSessionClient} from '../identity/session-client.js';
import {createPharmacyApplicationClient} from './application-client.js';

const sessionClient=createSessionClient();
const client=createPharmacyApplicationClient();
const fields=[['nombreComercial','Nombre comercial'],['contacto','Contacto ficticio'],
  ['direccion','Dirección ficticia'],['departamento','Departamento'],['provincia','Provincia'],
  ['distrito','Distrito'],['representante','Representante ficticio']];
const initial=Object.fromEntries(fields.map(([key])=>[key,'']));

export function PharmacyApplication(){
  const [session,setSession]=useState(undefined);
  const [items,setItems]=useState([]);
  const [itemsStatus,setItemsStatus]=useState('loading');
  const [form,setForm]=useState(initial);
  const [editing,setEditing]=useState(null);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  useEffect(()=>{let active=true;Promise.allSettled([sessionClient.session(),client.own()]).then(results=>{
    if(!active)return;
    if(results[0].status==='rejected'){setSession('unavailable');return;}
    setSession(results[0].value);
    if(!results[0].value)return;
    if(results[1].status==='fulfilled'){
      setItems(results[1].value);setItemsStatus('ready');
    }else setItemsStatus('error');
  });return()=>{active=false;};},[]);
  async function action(work){setBusy(true);setMessage('');try{
    await work();setItems(await client.own());setItemsStatus('ready');
    setMessage('Solicitud actualizada correctamente.');
  }catch(error){setMessage(error.message||'No se pudo completar la solicitud.');}
  finally{setBusy(false);}}
  if(session===undefined)return <p role="status">Comprobando sesión…</p>;
  if(session==='unavailable')return <p role="alert">No se pudo comprobar la sesión. Revisa la conexión y vuelve a intentarlo.</p>;
  if(!session)return <section><h1>Registrar mi farmacia</h1><p>Inicia sesión o crea una cuenta normal para presentar una solicitud. Enviarla no otorga permisos de farmacia.</p><a href="/identity?return=%2Ffarmacias%2Fsolicitar">Ir a mi cuenta</a></section>;
  return <main className="page-stack"><header><h1>Registrar mi farmacia</h1>
    <p>Entorno TEST/DEMO. Usa solo datos ficticios. El envío no activa la farmacia.</p></header>
    {message&&<p role="status">{message}</p>}
    <section className="card"><h2>{editing?'Editar solicitud':'Nueva solicitud'}</h2>
      <form onSubmit={event=>{event.preventDefault();void action(async()=>{
        if(editing)await client.edit(editing.id,editing.version,form);
        else await client.create(form);
        setForm(initial);setEditing(null);
      });}}>
        {fields.map(([key,label])=><label key={key}>{label}<input required maxLength={key==='direccion'?240:key==='nombreComercial'||key==='contacto'||key==='representante'?160:100}
          value={form[key]} onChange={event=>setForm({...form,[key]:event.target.value})}/></label>)}
        <button type="submit" disabled={busy}>{editing?'Guardar cambios':'Guardar borrador'}</button>
        {editing&&<button type="button" onClick={()=>{setEditing(null);setForm(initial);}}>Descartar edición</button>}
      </form></section>
    <section className="card"><h2>Mis solicitudes</h2>
      {itemsStatus==='loading'&&<p role="status">Cargando tus solicitudes…</p>}
      {itemsStatus==='error'&&<p role="alert">No se pudieron cargar tus solicitudes. Revisa la conexión.</p>}
      {itemsStatus==='ready'&&!items.length&&<p>Aún no tienes solicitudes.</p>}
      <ul>{items.map(item=><li key={item.id}><strong>{item.nombreComercial}</strong> · {item.estado}
        {['BORRADOR','OBSERVADA'].includes(item.estado)&&<button type="button" disabled={busy}
          onClick={()=>void action(()=>client.submit(item.id,item.version))}>Enviar solicitud</button>}
        {['BORRADOR','OBSERVADA'].includes(item.estado)&&<button type="button" disabled={busy}
          onClick={()=>void client.one(item.id).then(value=>{
            setEditing({id:item.id,version:item.version});
            setForm(Object.fromEntries(fields.map(([key])=>[key,value[key]??''])));
          }).catch(error=>setMessage(error.message))}>Editar</button>}
        {['BORRADOR','PENDIENTE','EN_REVISION','OBSERVADA'].includes(item.estado)&&<button type="button" disabled={busy}
          onClick={()=>void action(()=>client.cancel(item.id,item.version))}>Cancelar</button>}
      </li>)}</ul></section>
  </main>;
}
