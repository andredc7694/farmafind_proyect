import React, { useEffect, useState } from 'react';
import { AuthView } from './AuthView.jsx';
import { PharmacySelector } from './PharmacySelector.jsx';
import { MembershipAdmin } from './MembershipAdmin.jsx';
import { createSessionClient } from './session-client.js';

const identity = createSessionClient();

export function IdentityApp() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacyStatus, setPharmacyStatus] = useState('loading');
  const [activePharmacyId, setActivePharmacyId] = useState(null);
  const [selectingPharmacyId, setSelectingPharmacyId] = useState(null);

  useEffect(() => {
    let current = true;
    identity.session().then(session => {
      if (current) {
        setProfile(session);
        setStatus(session ? 'authenticated' : 'anonymous');
      }
    }).catch(() => {
      if (current) { setError(true); setStatus('anonymous'); }
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (status !== 'authenticated') {
      setPharmacies([]);
      setActivePharmacyId(null);
      return;
    }
    let current = true;
    setPharmacyStatus('loading');
    identity.memberships().then(own => {
      if (current) { setPharmacies(own); setPharmacyStatus('ready'); }
    }).catch(async () => {
      if (!current) return;
      setPharmacies([]);
      if (await recheckSession()) setPharmacyStatus('denied');
    });
    return () => { current = false; };
  }, [status]);

  useEffect(() => {
    if (status !== 'authenticated') return undefined;
    const verifyOnFocus = () => { void recheckSession(); };
    window.addEventListener('focus', verifyOnFocus);
    return () => window.removeEventListener('focus', verifyOnFocus);
  }, [status]);

  async function recheckSession() {
    try {
      const session = await identity.session();
      if (session) { setProfile(session); return true; }
      setProfile(null);
      setActivePharmacyId(null);
      setStatus('expired');
    } catch {
      setProfile(null);
      setActivePharmacyId(null);
      setError(true);
      setStatus('anonymous');
    }
    return false;
  }

  async function register(credentials) {
    setError(false);
    setNotice(null);
    setStatus('loading');
    try {
      await identity.register(credentials);
      setNotice('Solicitud recibida. Si corresponde, ya puedes iniciar sesión.');
      setStatus('anonymous');
    } catch {
      setError(true);
      setStatus('anonymous');
    }
  }

  async function login(credentials) {
    setError(false);
    setNotice(null);
    setStatus('loading');
    try {
      await identity.login(credentials);
      const session = await identity.session();
      if (!session) throw new Error('Sesión no disponible');
      setProfile(session);
      setStatus('authenticated');
    } catch {
      setProfile(null);
      setError(true);
      setStatus('anonymous');
    }
  }

  async function logout() {
    setError(false);
    setNotice(null);
    setStatus('loading');
    try {
      await identity.logout();
      setProfile(null);
      setNotice('Sesión cerrada.');
      setStatus('anonymous');
    } catch {
      if (await recheckSession()) {
        setError(true);
        setStatus('authenticated');
      }
    }
  }

  async function selectPharmacy(pharmacyId) {
    setSelectingPharmacyId(pharmacyId);
    try {
      const selected = await identity.selectPharmacy(pharmacyId);
      setActivePharmacyId(selected.pharmacyId);
      setPharmacies(await identity.memberships());
      setPharmacyStatus('ready');
    } catch {
      setActivePharmacyId(null);
      setPharmacies([]);
      if (await recheckSession()) setPharmacyStatus('denied');
    } finally {
      setSelectingPharmacyId(null);
    }
  }

  return <main className="bootstrap">
    <h1>FarmaFind — Identidad</h1>
    <AuthView status={status} error={error} notice={notice} profile={profile}
      onRegister={register} onLogin={login} onLogout={logout} />
    {status === 'authenticated' && <PharmacySelector pharmacies={pharmacies}
      activePharmacyId={activePharmacyId} selectingPharmacyId={selectingPharmacyId}
      status={pharmacyStatus} onSelect={selectPharmacy} />}
    {status === 'authenticated' && activePharmacyId && <MembershipAdmin pharmacyId={activePharmacyId} />}
  </main>;
}
