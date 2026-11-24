import React, { useEffect, useState } from 'react';
import { AuthView } from './AuthView.jsx';
import { PharmacySelector } from './PharmacySelector.jsx';
import { MembershipAdmin } from './MembershipAdmin.jsx';
import { StaffAdmin } from './StaffAdmin.jsx';
import { MyInvitations } from './MyInvitations.jsx';
import { PasswordReset } from './PasswordReset.jsx';
import { ForcedPasswordChange } from './ForcedPasswordChange.jsx';
import { createSessionClient } from './session-client.js';
import { InventoryView } from '../inventory/InventoryView.jsx';
import { ReservationsView } from '../reservations/ReservationsView.jsx';
import { LocationAdmin } from '../geolocation/LocationAdmin.jsx';
import { PrivatePharmacyProfile } from '../pharmacies/PrivatePharmacyProfile.jsx';

const identity = createSessionClient();

export function IdentityApp({ inventoryMode = false, reservationsMode = false, locationMode = false }) {
  const returnTo = typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('return') === '/farmacias/solicitar'
      ? '/farmacias/solicitar' : null;
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState(false);
  const [notice, setNotice] = useState(null);
  const [profile, setProfile] = useState(null);
  const [pharmacies, setPharmacies] = useState([]);
  const [pharmacyStatus, setPharmacyStatus] = useState('loading');
  const [activePharmacyId, setActivePharmacyId] = useState(null);
  const [selectingPharmacyId, setSelectingPharmacyId] = useState(null);
  const [membershipsVersion, setMembershipsVersion] = useState(0);
  const [resetting, setResetting] = useState(() => typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).has('reset'));
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  // F01.1: una sesión con cambio de clave pendiente solo puede completar ese paso.
  const restricted = profile?.restriction === 'CAMBIO_CLAVE';

  useEffect(() => {
    let current = true;
    identity.session().then(session => {
      if (current) {
        setProfile(session);
        setStatus(session ? 'authenticated' : 'anonymous');
        window.dispatchEvent(new Event('farmafind:session-changed'));
      }
    }).catch(() => {
      if (current) { setError(false); setStatus('unavailable'); }
    });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (status !== 'authenticated' || restricted) {
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
  }, [status, restricted, membershipsVersion]);

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
      window.dispatchEvent(new Event('farmafind:session-changed'));
    } catch {
      setProfile(null);
      setActivePharmacyId(null);
      setError(false);
      setStatus('unavailable');
      window.dispatchEvent(new Event('farmafind:session-changed'));
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
      window.dispatchEvent(new Event('farmafind:session-changed'));
    } catch {
      setProfile(null);
      setError(true);
      setStatus('anonymous');
      window.dispatchEvent(new Event('farmafind:session-changed'));
    }
  }

  async function changePassword(newPassword) {
    setPasswordBusy(true); setPasswordError(false);
    try {
      await identity.changeTemporaryPassword(newPassword);
      const session = await identity.session();
      if (!session) throw new Error('Sesión no disponible');
      setProfile(session);
      window.dispatchEvent(new Event('farmafind:session-changed'));
    } catch { setPasswordError(true); }
    finally { setPasswordBusy(false); }
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
      window.dispatchEvent(new Event('farmafind:session-changed'));
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
      window.dispatchEvent(new Event('farmafind:session-changed'));
    } catch {
      setActivePharmacyId(null);
      setPharmacies([]);
      if (await recheckSession()) setPharmacyStatus('denied');
    } finally {
      setSelectingPharmacyId(null);
    }
  }

  return <main className="bootstrap">
    <h1>{inventoryMode ? 'FarmaFind — Inventario' : reservationsMode ? 'FarmaFind — Reservas'
      : locationMode ? 'FarmaFind — Ubicación' : 'FarmaFind — Identidad'}</h1>
    {status === 'anonymous' && reservationsMode && <p>Inicia sesión para consultar tus reservas o solicitar una desde una oferta pública.</p>}
    {status === 'anonymous' && (inventoryMode || locationMode) && <p>Inicia sesión con una membresía autorizada para acceder a esta área.</p>}
    {status === 'authenticated' && restricted && <ForcedPasswordChange busy={passwordBusy} error={passwordError}
      onSubmit={changePassword} onLogout={logout} />}
    {status === 'anonymous' && resetting && <PasswordReset api={identity} onDone={() => setResetting(false)}
      initialToken={typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('reset') ?? '' : ''} />}
    {!(status === 'authenticated' && restricted) && !(status === 'anonymous' && resetting) && <AuthView status={status} error={error} notice={notice} profile={profile}
      returnTo={returnTo}
      onRegister={register} onLogin={login} onLogout={logout} onForgotPassword={() => setResetting(true)} />}
    {status === 'authenticated' && !restricted && !inventoryMode && !reservationsMode && !locationMode &&
      <MyInvitations onAccepted={() => setMembershipsVersion(value => value + 1)} />}
    {status === 'authenticated' && !restricted && <PharmacySelector pharmacies={pharmacies}
      activePharmacyId={activePharmacyId} selectingPharmacyId={selectingPharmacyId}
      status={pharmacyStatus} onSelect={selectPharmacy} />}
    {status === 'authenticated' && !restricted && reservationsMode && <ReservationsView pharmacyId={activePharmacyId}
      capabilities={pharmacies.find(item => item.pharmacyId === activePharmacyId)?.delegationCodes ?? []} />}
    {status === 'authenticated' && !restricted && locationMode && <LocationAdmin pharmacyId={activePharmacyId}
      delegationCodes={pharmacies.find(item => item.pharmacyId === activePharmacyId)?.delegationCodes ?? []} />}
    {status === 'authenticated' && !restricted && locationMode && activePharmacyId &&
      !(pharmacies.find(item => item.pharmacyId === activePharmacyId)?.delegationCodes ?? [])
        .some(code => code === 'GEO_LOCATION_PROPOSE' || code === 'GEO_LOCATION_REVIEW') &&
      <p role="status">No tienes permiso para administrar la ubicación de esta farmacia.</p>}
    {status === 'authenticated' && !restricted && activePharmacyId && !reservationsMode && !locationMode && (inventoryMode
      ? <><PrivatePharmacyProfile pharmacyId={activePharmacyId}
          capabilities={pharmacies.find(item => item.pharmacyId === activePharmacyId)?.delegationCodes ?? []} />
        <InventoryView pharmacyId={activePharmacyId}
          capabilities={pharmacies.find(item => item.pharmacyId === activePharmacyId)?.delegationCodes ?? []} /></>
      : <><MembershipAdmin pharmacyId={activePharmacyId} /><StaffAdmin pharmacyId={activePharmacyId} /></>)}
  </main>;
}
