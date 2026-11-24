/** F01.1 — recorridos de navegador sobre un fixture TEST efímero con datos ficticios (T053). */
import { test, expect } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

test.use({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block', screenshot: 'only-on-failure' });
test.describe.configure({ mode: 'serial', timeout: 90000 });

const env = name => { const value = process.env[name]; if (!value) throw new Error(`Falta ${name}`); return value; };
const owner = { email: env('F011_OWNER_EMAIL'), password: env('F011_OWNER_PASSWORD') };
const ownerB = { email: env('F011_OWNER_B_EMAIL'), password: env('F011_OWNER_B_PASSWORD') };
const client = { email: env('F011_CLIENT_EMAIL'), password: env('F011_CLIENT_PASSWORD') };
const admin = { email: env('F011_ADMIN_EMAIL'), password: env('F011_ADMIN_PASSWORD') };
const workerAlias = `alfa.caja${Date.now().toString(36)}`.slice(0, 20);
const workerPassword = 'Clave-Definitiva-Trabajador-1';
const newClientPassword = 'Clave-Restablecida-Cliente-2';
const state = {};

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32Decode(text) {
  let bits = 0; let value = 0; const out = [];
  for (const char of text) { value = (value << 5) | alphabet.indexOf(char); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
}
function totp(secret, stepOffset = 0) {
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000) + stepOffset));
  const mac = createHmac('sha1', base32Decode(secret)).update(counter).digest(); const offset = mac[mac.length - 1] & 0x0f;
  const binary = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3];
  return String(binary % 1_000_000).padStart(6, '0');
}
async function mailFor(to, kind) {
  for (let attempt = 0; attempt < 60; attempt++) {
    let text = ''; try { text = readFileSync(`${env('F011_MAILBOX_DIR')}/mailbox.jsonl`, 'utf8'); } catch { /* aún sin mensajes */ }
    const found = text.split('\n').filter(Boolean).map(line => JSON.parse(line)).filter(entry => entry.to === to && entry.kind === kind);
    if (found.length) return found[found.length - 1];
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`No llegó ${kind} para ${to}`);
}
async function open(page) {
  await page.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort());
  // El servidor de desarrollo puede reiniciar la página al optimizar dependencias: un reintento acotado.
  try { await page.goto('/identity'); } catch { await page.goto('/identity'); }
}
async function login(page, identifier, password) {
  const form = page.locator('form').filter({ has: page.getByRole('button', { name: 'Iniciar sesión' }) });
  await form.getByLabel('Usuario o correo electrónico').fill(identifier);
  await form.getByLabel('Contraseña').fill(password);
  await form.getByRole('button', { name: 'Iniciar sesión' }).click();
}
const status = (page, url) => page.evaluate(async target => (await fetch(target, { credentials: 'same-origin' })).status, url);

test('propietario Alfa crea un trabajador con alias; la clave temporal se ve una sola vez', async ({ page }) => {
  await open(page); await login(page, owner.email, owner.password);
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await expect(page.getByRole('heading', { name: 'Personal de la farmacia' })).toBeVisible();
  await page.getByLabel('Usuario (alias) del trabajador').fill(workerAlias);
  await page.getByLabel('Nombre para mostrar').fill('Caja uno ficticia');
  await page.getByLabel('Ver inventario').first().check();
  await page.getByRole('button', { name: 'Crear cuenta de trabajador' }).click();
  const key = page.getByLabel('Clave temporal');
  await expect(key).toBeVisible();
  state.temporaryKey = (await key.textContent()).trim();
  expect(state.temporaryKey).toMatch(/^[0-9A-Z]{8}(-[0-9A-Z]{8}){3}$/);
  await page.getByRole('button', { name: 'Ya la entregué; ocultar' }).click();
  await expect(page.getByLabel('Clave temporal')).toHaveCount(0);
  await expect(page.getByText(workerAlias).first()).toBeVisible();
  await expect(page.getByText(state.temporaryKey)).toHaveCount(0);
  // Aislamiento: el propietario de Beta no ve a ese trabajador ni puede consultar Alfa.
  state.alfaId = await page.evaluate(async () => (await (await fetch('/api/v1/me/memberships', { credentials: 'same-origin' })).json())[0].pharmacyId);
  const other = await page.context().browser().newContext({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
  const second = await other.newPage(); await open(second); await login(second, ownerB.email, ownerB.password);
  await second.getByRole('button', { name: 'Farmacia Beta' }).click();
  await expect(second.getByRole('heading', { name: 'Personal de la farmacia' })).toBeVisible();
  await expect(second.getByText(workerAlias)).toHaveCount(0);
  expect(await status(second, `/api/v1/pharmacies/${state.alfaId}/staff`)).toBe(404);
  await other.close();
});

test('primer ingreso del trabajador: clave temporal → cambio obligatorio → acceso; la temporal no se reutiliza', async ({ page }) => {
  await open(page); await login(page, workerAlias, state.temporaryKey);
  await expect(page.getByRole('heading', { name: 'Define tu clave definitiva' })).toBeVisible();
  expect(await status(page, '/api/v1/me/memberships')).toBe(403); // sesión restringida: nada más
  await page.getByLabel('Clave nueva (mínimo 12 caracteres)').fill(workerPassword);
  await page.getByLabel('Repite la clave nueva').fill(workerPassword);
  await page.getByRole('button', { name: 'Guardar clave y continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Farmacia Alfa' })).toBeVisible();
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page.getByText('Sesión cerrada.')).toBeVisible();
  await login(page, workerAlias, state.temporaryKey); // la clave temporal ya no sirve
  await expect(page.getByRole('alert')).toContainText('No se pudo completar la solicitud');
  await login(page, workerAlias, workerPassword);
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
});

test('invitación a una cuenta existente: aceptar da acceso; revocar lo retira de inmediato', async ({ page }) => {
  await open(page); await login(page, owner.email, owner.password);
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  await page.getByLabel('Correo de la persona').fill(client.email);
  await page.getByRole('button', { name: 'Enviar invitación' }).click();
  await expect(page.getByText('No se confirma si la cuenta existe.')).toBeVisible();
  const customer = await page.context().browser().newContext({ baseURL: 'http://127.0.0.1:5173', serviceWorkers: 'block' });
  const guest = await customer.newPage(); await open(guest); await login(guest, client.email, client.password);
  await expect(guest.getByRole('heading', { name: 'Mis invitaciones' })).toBeVisible();
  await guest.getByRole('button', { name: 'Aceptar' }).click();
  await expect(guest.getByRole('button', { name: 'Farmacia Alfa' })).toBeVisible();
  // El propietario revoca desde la pantalla; el invitado pierde el acceso sin volver a iniciar sesión.
  await page.reload();
  await page.getByRole('button', { name: 'Farmacia Alfa' }).click();
  const staff = page.locator('section[aria-labelledby="staff-admin-title"]');
  await expect(staff.getByRole('heading', { name: 'Personal de la farmacia' })).toBeVisible();
  const invitedRow = staff.getByRole('listitem').filter({ hasText: 'sin nombre' }).first();
  await invitedRow.getByRole('button', { name: 'Revocar acceso' }).click();
  await invitedRow.getByRole('button', { name: 'Confirmar revocación' }).click();
  await expect(staff.getByRole('listitem').filter({ hasText: 'sin nombre' }).filter({ hasText: 'REVOCADA' })).toHaveCount(1);
  // Al perder su última membresía se cierran todas sus sesiones (decisión A): la sesión del invitado ya no sirve.
  expect(await status(guest, '/api/v1/me/memberships')).toBe(401);
  await customer.close();
});

test('recuperación: «Olvidé mi clave» → código por el simulador → clave nueva → acceso', async ({ page }) => {
  await open(page);
  await page.getByRole('button', { name: 'Olvidé mi clave' }).click();
  await page.getByLabel('Correo electrónico de tu cuenta').fill(client.email);
  await page.getByRole('button', { name: 'Enviar código' }).click();
  await expect(page.getByRole('status')).toContainText('Si existe una cuenta');
  const message = await mailFor(client.email, 'RESTABLECER_CLAVE');
  await page.getByLabel('Código recibido').fill(message.code);
  await page.getByLabel('Clave nueva (mínimo 12 caracteres)').fill(newClientPassword);
  await page.getByLabel('Repite la clave nueva').fill(newClientPassword);
  await page.getByRole('button', { name: 'Cambiar clave' }).click();
  await expect(page.getByRole('heading', { name: 'Clave restablecida' })).toBeVisible();
  await page.getByRole('button', { name: 'Ir a iniciar sesión' }).click();
  await login(page, client.email, client.password);
  await expect(page.getByRole('alert')).toContainText('No se pudo completar la solicitud'); // la clave anterior ya no sirve
  await login(page, client.email, newClientPassword);
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
});

test('administrador general: alta del segundo factor, inicio con código y /platform solo tras verificar', async ({ page }) => {
  await open(page); await login(page, admin.email, admin.password);
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  expect(await status(page, '/api/v1/platform/role-assignments')).toBe(403); // sin factor verificado
  await page.getByText('Segundo factor (administradores de la plataforma)').click();
  await page.getByRole('button', { name: 'Activar segundo factor' }).click();
  const secret = (await page.getByLabel('Clave del segundo factor').textContent()).trim();
  await page.getByLabel('Primer código generado').fill(totp(secret));
  await page.getByRole('button', { name: 'Activar', exact: true }).click();
  await expect(page.getByText('Segundo factor activo en esta sesión.')).toBeVisible();
  await expect(page.getByLabel('Clave del segundo factor')).toHaveCount(0);
  expect(await status(page, '/api/v1/platform/role-assignments')).toBe(200);
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await login(page, admin.email, admin.password);
  await expect(page.getByRole('heading', { name: 'Segundo factor' })).toBeVisible();
  expect(await status(page, '/api/v1/platform/role-assignments')).toBe(403);
  await page.getByLabel('Código de verificación').fill('000000');
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('alert')).toContainText('El código no es válido');
  await page.getByLabel('Código de verificación').fill(totp(secret, 1)); // el paso del alta ya está consumido
  await page.getByRole('button', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: 'Sesión activa' })).toBeVisible();
  expect(await status(page, '/api/v1/platform/role-assignments')).toBe(200);
});

test('perfil: editar datos, cambiar la clave y ver las sesiones propias', async ({ page }) => {
  await open(page); await login(page, client.email, newClientPassword);
  await page.getByText('Mi perfil y seguridad').click();
  await page.getByLabel('Nombre', { exact: true }).fill('Cliente ficticio');
  await page.getByLabel('Tema').selectOption('OSCURO');
  await page.getByRole('button', { name: 'Guardar datos' }).click();
  await expect(page.getByText('Datos guardados.')).toBeVisible();
  await expect(page.getByText(/rol|permiso/i)).toHaveCount(0);
  await expect(page.getByText('Esta sesión')).toBeVisible();
  await page.getByLabel('Clave actual', { exact: true }).fill(newClientPassword);
  await page.getByLabel('Clave nueva (mínimo 12 caracteres)').fill('Clave-Perfil-Cliente-3');
  await page.getByLabel('Repite la clave nueva').fill('Clave-Perfil-Cliente-3');
  await page.getByRole('button', { name: 'Cambiar clave' }).click();
  await expect(page.getByText('Clave cambiada. Las demás sesiones se cerraron.')).toBeVisible();
  await expect(page.getByText('Clave-Perfil-Cliente-3')).toHaveCount(0);
});
