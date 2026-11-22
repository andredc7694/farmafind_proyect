import React,{useEffect,useState} from 'react';
import {createPharmacyApplicationClient} from './application-client.js';

const client=createPharmacyApplicationClient();
export function PrivatePharmacyProfile({pharmacyId,capabilities=[]}){
  const [profile,setProfile]=useState(null),[contact,setContact]=useState('');
  const [status,setStatus]=useState('loading'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const canRead=capabilities.includes('pharmacy.profile.read');
  const canWrite=capabilities.includes('pharmacy.profile.write');
  useEffect(()=>{
    if(!pharmacyId||!canRead){setProfile(null);setStatus('denied');return;}
    let current=true;setStatus('loading');setMessage('');
    client.profile(pharmacyId).then(value=>{if(current){setProfile(value);setContact(value.contacto);setStatus('ready');}})
      .catch(()=>{if(current){setProfile(null);setStatus('error');}});
    return()=>{current=false;};
  },[pharmacyId,canRead]);
  if(!canRead)return null;
  async function save(event){
    event.preventDefault();if(!canWrite||!profile||busy)return;
    setBusy(true);setMessage('');
    try{const updated=await client.updateProfile(pharmacyId,contact,profile.version);
      setProfile(updated);setContact(updated.contacto);setMessage('Contacto actualizado.');}
    catch(error){setMessage(error?.message||'No se pudo actualizar el contacto.');}
    finally{setBusy(false);}
  }
  return <section className="card" aria-labelledby="private-pharmacy-profile-title">
    <h2 id="private-pharmacy-profile-title">Perfil privado de la farmacia</h2>
    {status==='loading'&&<p role="status">Cargando perfil autorizado…</p>}
    {status==='error'&&<p role="alert">No se pudo consultar el perfil autorizado.</p>}
    {profile&&<><p>Dirección: {profile.direccion}, {profile.distrito}, {profile.provincia}.</p>
      <p>Versión: {profile.version}</p>
      {canWrite?<form onSubmit={save}><label>Contacto operativo
        <input value={contact} minLength={1} maxLength={160} required
          onChange={event=>setContact(event.target.value)}/></label>
        <button type="submit" disabled={busy||contact.trim().length<1||contact.trim().length>160}>
          {busy?'Guardando…':'Guardar contacto'}</button></form>
        :<p>Contacto: {profile.contacto}</p>}
    </>}
    {message&&<p role={message.startsWith('Contacto actualizado')?'status':'alert'}>{message}</p>}
  </section>;
}
