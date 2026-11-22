import busboy from 'busboy';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { authHttpSecurity, readSessionCookie, sendIdentityError,
  type AuthHttpOptions } from '../../usuarios/contracts/http-security.js';
import { PreviewInputError, type PreviewImport } from '../application/preview-import.js';
import { ImportConflictError, type ConfirmImport } from '../application/confirm-import.js';
import type { ImportMapping } from '../domain/importacion.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const fields = ['nombre','concentracion','presentacion','clasificacion','precioReferencial','cantidadFisica'] as const;

class UploadError extends Error { constructor(readonly tooLarge = false) { super('Archivo inválido'); } }

async function readUpload(request: Request): Promise<{ bytes: Buffer; filename: string; mapping: ImportMapping }> {
  const contentType = request.get('Content-Type') ?? '';
  if (contentType.length > 200 || !/^multipart\/form-data;\s*boundary=/i.test(contentType)) throw new UploadError();
  return new Promise((resolve, reject) => {
    let failed: Error | null = null;
    let filename = '';
    let fileSeen = false;
    let mapText = '';
    let mapSeen = false;
    const chunks: Buffer[] = [];
    const parser = busboy({ headers: request.headers, limits: {
      fileSize: 5 * 1024 * 1024, files: 1, fields: 1, parts: 3,
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
      if (name !== 'mapeo' || mapSeen || info.valueTruncated) failed = new UploadError();
      mapSeen = true; mapText = value;
    });
    parser.on('filesLimit', () => { failed = new UploadError(); });
    parser.on('fieldsLimit', () => { failed = new UploadError(); });
    parser.on('partsLimit', () => { failed = new UploadError(); });
    parser.on('error', () => reject(new UploadError()));
    request.on('aborted', () => reject(new UploadError()));
    parser.on('close', () => {
      if (failed) { reject(failed); return; }
      if (!fileSeen || !mapSeen) { reject(new UploadError()); return; }
      try {
        const unknown = JSON.parse(mapText) as unknown;
        if (!unknown || typeof unknown !== 'object' || Array.isArray(unknown)) throw new Error();
        const values = unknown as Record<string, unknown>;
        if (Object.keys(values).some(key => ![...fields,'farmaciaId'].includes(key)) ||
            fields.some(key => typeof values[key] !== 'string' || !(values[key] as string).trim()) ||
            (values.farmaciaId !== undefined && typeof values.farmaciaId !== 'string')) throw new Error();
        resolve({ bytes: Buffer.concat(chunks), filename, mapping: values as unknown as ImportMapping });
      } catch { reject(new UploadError()); }
    });
    request.pipe(parser);
  });
}

export function createImportRouter(preview: Pick<PreviewImport, 'authorize' | 'run'>,
  confirm: Pick<ConfirmImport, 'confirm' | 'history' | 'status'>,
  options: AuthHttpOptions): Router {
  const router = Router();
  const security = authHttpSecurity(options);
  router.use((_request, response, next) => { response.set('Cache-Control', 'no-store'); next(); });
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
        response.status(200).json(await preview.run(secret, pharmacyId,
          upload.bytes, upload.filename, upload.mapping));
      } catch (error) {
        if (error instanceof UploadError) {
          sendIdentityError(response, error.tooLarge ? 413 : 400, 'BAD_REQUEST', 'Archivo no válido');
        } else if (error instanceof PreviewInputError) {
          sendIdentityError(response, 400, 'BAD_REQUEST', 'Archivo o mapeo no válido');
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
    async (request, response) => {
      const current = scope(request, response);
      if (!current) return;
      if (typeof request.params.importId !== 'string' || !uuid.test(request.params.importId)) {
        sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); return;
      }
      try { response.status(200).json(await confirm.confirm(current.secret, current.pharmacyId,
        request.params.importId)); }
      catch (error) {
        if (error instanceof ImportConflictError) {
          sendIdentityError(response, 409, 'CONFLICT', 'Importación no confirmable');
        } else { sendIdentityError(response, 404, 'NOT_VISIBLE', 'Recurso no visible'); }
      }
    });
  return router;
}
