import busboy from 'busboy';
import { Router, json } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError,
  type AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { describeFileError, PreviewInputError, type PreviewImport } from '../application/preview-import.js';
import { ImportConflictError, type ConfirmImport } from '../application/confirm-import.js';
import type { ImportMapping, ImportExclusion } from '../domain/importacion.js';
import type { InspectImport } from '../application/inspect-import.js';
import type { ImportProfiles } from '../application/import-profiles.js';
import type { InventoryFileSelection } from '../domain/importacion.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ['nombre','concentracion','presentacion','clasificacion','precioReferencial','cantidadFisica'] as const;

class UploadError extends Error { constructor(readonly tooLarge = false) { super('Archivo inválido'); } }

async function readUpload(request: Request, requireMapping = true): Promise<{
  bytes: Buffer; filename: string; mapping?: ImportMapping;
  selection?: InventoryFileSelection & { digest: string } }> {
  const contentType = request.get('Content-Type') ?? '';
  if (contentType.length > 200 || !/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw new UploadError();
  return new Promise((resolve, reject) => {
    let failed: Error | null = null;
    let filename = '';
    let fileSeen = false;
    let mapText = '';
    let mapSeen = false;
    let selectionText = '';
    let selectionSeen = false;
    const chunks: Buffer[] = [];
    const parser = busboy({ headers: request.headers, limits: {
      fileSize: 5 * 1024 * 1024, files: 1, fields: 2, parts: 4,
      fieldSize: 4096, headerPairs: 20,
    } });
    parser.on('file', (name, stream, info) => {
      if (name !== 'archivo' || fileSeen) failed = new UploadError();
      fileSeen = true;
      filename = info.filename ?? '';
      stream.on('data', (chunk: Buffer) => { chunks.push(chunk); });
      stream.on('limit', () => { failed = new UploadError(true); });
      stream.on('error', () => { failed = new UploadError(); });
    });
    parser.on('field', (name, value, info) => {
      if (info.valueTruncated) failed = new UploadError();
      if (name === 'mapeo' && !mapSeen) { mapSeen = true; mapText = value; }
      else if (name === 'seleccion' && !selectionSeen) { selectionSeen = true; selectionText = value; }
      else failed = new UploadError();
    });
    parser.on('filesLimit', () => { failed = new UploadError(); });
    parser.on('fieldsLimit', () => { failed = new UploadError(); });
    parser.on('partsLimit', () => { failed = new UploadError(); });
    parser.on('error', () => reject(new UploadError()));
    request.on('aborted', () => reject(new UploadError()));
    parser.on('close', () => {
      if (failed) { reject(failed); return; }
      if (!fileSeen || (requireMapping && !mapSeen)) { reject(new UploadError()); return; }
      try {
        if (!mapSeen && !selectionSeen) { resolve({ bytes: Buffer.concat(chunks), filename }); return; }
        const unknown = JSON.parse(mapText) as unknown;
        if (!unknown || typeof unknown !== 'object' || Array.isArray(unknown)) throw new Error();
        const values = unknown as Record<string, unknown>;
        if (Object.keys(values).some(key => ![...fields,'farmaciaId'].includes(key)) ||
            fields.some(key => typeof values[key] !== 'string' || !(values[key] as string).trim()) ||
            (values.farmaciaId !== undefined && typeof values.farmaciaId !== 'string')) throw new Error();
        let selection: InventoryFileSelection & { digest: string } | undefined;
        if (selectionSeen) {
          const raw = JSON.parse(selectionText) as Record<string, unknown>;
          if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
              Object.keys(raw).some(key => !['sheet','headerRow','digest'].includes(key)) ||
              typeof raw.sheet !== 'string' || raw.sheet.length > 100 ||
              !Number.isInteger(raw.headerRow) || typeof raw.digest !== 'string' ||
              !/^[0-9a-f]{64}$/.test(raw.digest)) throw new Error();
          selection = raw as unknown as InventoryFileSelection & { digest: string };
        }
        resolve({ bytes: Buffer.concat(chunks), filename, mapping: values as unknown as ImportMapping, selection });
      } catch { reject(new UploadError()); }
    });
    request.pipe(parser);
  });
}

const wholeNumber = (value: unknown) => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 5000;

/** Sin cuerpo: confirmar el archivo completo. Con cuerpo, solo la exclusión explícita y sus dos conteos. */
function readExclusion(body: unknown): ImportExclusion | undefined | null {
  if (body === undefined || body === null) return undefined;
  if (typeof body !== 'object' || Array.isArray(body)) return null;
  const keys = Object.keys(body);
  if (keys.length === 0) return undefined;
  const value = (body as Record<string, unknown>).excluir as Record<string, unknown> | undefined;
  if (keys.join(',') !== 'excluir' || !value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'duplicadas,pendientes' ||
      !wholeNumber(value.duplicadas) || !wholeNumber(value.pendientes)) return null;
  return { duplicadas: value.duplicadas as number, pendientes: value.pendientes as number };
}

function uploadMessage(tooLarge: boolean): string {
  return tooLarge ? 'El archivo pesa más de 5 MB. Divídelo en partes más pequeñas.'
    : 'No se recibió un archivo válido. Elige un solo archivo .xlsx o .csv e inténtalo de nuevo.';
}

export function createImportRouter(preview: Pick<PreviewImport, 'authorize' | 'run'>,
  confirm: Pick<ConfirmImport, 'confirm' | 'history' | 'status'>,
  options: AuthHttpOptions, profiles?: Pick<ImportProfiles, 'list' | 'save'>,
  inspect?: Pick<InspectImport, 'run'>): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
  router.post('/farmacias/:pharmacyId/importaciones/analizar', security.requireCsrf,
    async (request: Request, response: Response) => {
      if (!inspect) { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return; }
      const secret = readSessionCookie(request, options);
      if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
      const pharmacyId = request.params.pharmacyId;
      if (typeof pharmacyId !== 'string' || !uuid.test(pharmacyId)) {
        sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
      }
      try { await preview.authorize(secret, pharmacyId); }
      catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return; }
      try {
        const upload = await readUpload(request, false);
        response.status(200).json(await inspect.run(secret, pharmacyId, upload.bytes, upload.filename));
      } catch (error) {
        if (error instanceof UploadError) {
          sendIdentityError(response, error.tooLarge ? 413 : 400, 'BAD_REQUEST', uploadMessage(error.tooLarge));
        } else { sendIdentityError(response, 400, 'BAD_REQUEST', describeFileError(error)); }
      }
    });
  router.post('/farmacias/:pharmacyId/importaciones/vista-previa', security.requireCsrf,
    async (request: Request, response: Response) => {
      const secret = readSessionCookie(request, options);
      if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return; }
      const pharmacyId = request.params.pharmacyId;
      if (typeof pharmacyId !== 'string' || !uuid.test(pharmacyId)) {
        sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
      }
      try { await preview.authorize(secret, pharmacyId); }
      catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return; }
      try {
        const upload = await readUpload(request);
        if (!upload.mapping) throw new UploadError();
        response.status(200).json(await preview.run(secret, pharmacyId,
          upload.bytes, upload.filename, upload.mapping, upload.selection));
      } catch (error) {
        if (error instanceof UploadError) {
          sendIdentityError(response, error.tooLarge ? 413 : 400, 'BAD_REQUEST', uploadMessage(error.tooLarge));
        } else if (error instanceof PreviewInputError) {
          sendIdentityError(response, error.conflict ? 409 : 400, error.conflict ? 'CONFLICT' : 'BAD_REQUEST', error.message);
        } else if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
          sendIdentityError(response, 409, 'CONFLICT', 'Archivo repetido');
        } else { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
      }
    });

  function scope(request: Request, response: Response): { secret: string; pharmacyId: string } | null {
    const secret = readSessionCookie(request, options);
    if (!secret) { sendIdentityError(response, 401, 'UNAUTHENTICATED', 'Sesión no válida'); return null; }
    const pharmacyId = request.params.pharmacyId;
    if (typeof pharmacyId !== 'string' || !uuid.test(pharmacyId)) {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return null;
    }
    return { secret, pharmacyId };
  }

  if (profiles) {
    router.get('/farmacias/:pharmacyId/importaciones/perfiles', async (request, response) => {
      const current = scope(request, response);
      if (!current) return;
      try { response.status(200).json(await profiles.list(current.secret, current.pharmacyId)); }
      catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
    });
    router.post('/farmacias/:pharmacyId/importaciones/perfiles', security.requireCsrf,
      async (request, response) => {
        const current = scope(request, response);
        if (!current) return;
        const body = request.body as Record<string, unknown> | undefined;
        if (!body || typeof body !== 'object' || Array.isArray(body) ||
            Object.keys(body).sort().join(',') !== 'importacionId,nombre' ||
            typeof body.importacionId !== 'string' || !uuid.test(body.importacionId) ||
            typeof body.nombre !== 'string' || body.nombre.length > 80) {
          sendIdentityError(response, 400, 'BAD_REQUEST', 'Perfil no válido'); return;
        }
        try { response.status(201).json(await profiles.save(current.secret, current.pharmacyId,
          body.importacionId, body.nombre)); }
        catch (error) {
          if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') {
            sendIdentityError(response, 409, 'CONFLICT', 'Ya existe un perfil con ese nombre');
          } else { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
        }
      });
  }

  router.get('/farmacias/:pharmacyId/importaciones', async (request, response) => {
    const current = scope(request, response);
    if (!current) return;
    try { response.status(200).json(await confirm.history(current.secret, current.pharmacyId)); }
    catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
  });

  router.get('/farmacias/:pharmacyId/importaciones/:importId', async (request, response) => {
    const current = scope(request, response);
    if (!current) return;
    if (typeof request.params.importId !== 'string' || !uuid.test(request.params.importId)) {
      sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
    }
    try { response.status(200).json(await confirm.status(current.secret, current.pharmacyId,
      request.params.importId)); }
    catch { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
  });

  router.post('/farmacias/:pharmacyId/importaciones/:importId/confirmar', security.requireCsrf,
    json({ limit: '1kb' }), (_error: unknown, _request: Request, response: Response, _next: NextFunction) => {
      sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no válida');
    }, async (request: Request, response: Response) => {
      const current = scope(request, response);
      if (!current) return;
      if (typeof request.params.importId !== 'string' || !uuid.test(request.params.importId)) {
        sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
      }
      const exclusion = readExclusion(request.body);
      if (exclusion === null) { sendIdentityError(response, 400, 'BAD_REQUEST', 'Entrada no válida'); return; }
      try { response.status(200).json(await confirm.confirm(current.secret, current.pharmacyId,
        request.params.importId, exclusion)); }
      catch (error) {
        if (error instanceof ImportConflictError) {
          sendIdentityError(response, 409, 'CONFLICT', 'Importación no confirmable');
        } else { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
      }
    });
  return router;
}
