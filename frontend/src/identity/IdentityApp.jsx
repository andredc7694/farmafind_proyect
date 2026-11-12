import React, { useEffect, useState } from 'react';
import { AuthView } from './AuthView.jsx';
import { PharmacySelector } from './PharmacySelector.jsx';
import { MembershipAdmin } from './MembershipAdmin.jsx';
import { createSessionClient } from './session-client.js';

const identity = createSessionClient();

export function IdentityApp() {
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(false);
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacyStatus, setPharmacyStatus] = useState('loading');
  const [activePharmacyId, setActivePharmacyId] = useState(null);
  const [selectingPharmacyId, setSelectingPharmacyId] = useState(null);

  useEffect(() => {
    let current = true;
    identity.session().then(session => {
      if (current) setStatus(session ? 'authenticated' : 'anonymous');
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
    }).catch(() => {
      if (current) { setPharmacies([]); setPharmacyStatus('denied'); }
    });
    return () => { current = false; };
  }, [status]);

  async function run(action, after) {
    setError(false);
    setStatus('loading');
    try {
      await action();
      setStatus(after);
    } catch {
      setError(true);
      setStatus('anonymous');
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
      setPharmacyStatus('denied');
    } finally {
      setSelectingPharmacyId(null);
    }
  }

  return <main className="bootstrap">
    <h1>FarmaFind — Identidad</h1>
    <AuthView status={status} error={error}
      onRegister={credentials => run(() => identity.register(credentials), 'anonymous')}
      onLogin={credentials => run(() => identity.login(credentials), 'authenticated')}
      onLogout={() => run(() => identity.logout(), 'anonymous')} />
    {status === 'authenticated' && <PharmacySelector pharmacies={pharmacies}
      activePharmacyId={activePharmacyId} selectingPharmacyId={selectingPharmacyId}
      status={pharmacyStatus} onSelect={selectPharmacy} />}
    {status === 'authenticated' && activePharmacyId && <MembershipAdmin pharmacyId={activePharmacyId} />}
  </main>;
}
