import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export interface AuthHttpOptions {
  readonly allowedOrigin: string;
  readonly csrfKey: Buffer;
  readonly cookieSecure: boolean;
}

export function sendIdentityError(response: Response, status: number, code: string, message: string,
  correlationId = randomUUID()): void {
  response.set('Cache-Control', 'no-store');
  response.status(status).json({ code, message, correlationId });
}

function cookieName(kind: 'session' | 'csrf', secure: boolean): string {
  return secure ? `__Host-ff-${kind}` : `ff-${kind}-local`;
}

function cookieValue(request: Request, name: string): string | null {
  const matches = (request.get('Cookie') ?? '').split(';').map(part => part.trim())
    .filter(part => part.startsWith(`${name}=`));
  return matches.length === 1 ? matches[0].slice(name.length + 1) : null;
}

export function readSessionCookie(request: Request, options: AuthHttpOptions): string | null {
  const value = cookieValue(request, cookieName('session', options.cookieSecure));
  return value && /^[a-f0-9]{64}$/i.test(value) ? value : null;
}

function tokenFor(nonce: string, sessionSecret: string | null, key: Buffer): string {
  return createHmac('sha256', key).update('f01-csrf\0').update(nonce).update('\0')
    .update(sessionSecret ?? 'pre-session').digest('hex');
}

export function authHttpSecurity(options: AuthHttpOptions) {
  if (options.csrfKey.length < 32) throw new Error('Clave CSRF insuficiente');
  const allowed = new URL(options.allowedOrigin);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(allowed.hostname);
  if (allowed.origin !== options.allowedOrigin ||
      !['http:', 'https:'].includes(allowed.protocol) ||
      (allowed.protocol === 'https:' && !options.cookieSecure) ||
      (allowed.protocol === 'http:' && (options.cookieSecure || !loopback))) {
    throw new Error('Cookie sin Secure solo en origen loopback');
  }
  const baseCookie = { httpOnly: true, secure: options.cookieSecure, sameSite: 'strict' as const, path: '/' };

  return {
    issueCsrf(request: Request, response: Response): void {
      const nonce = randomBytes(32).toString('hex');
      response.cookie(cookieName('csrf', options.cookieSecure), nonce, { ...baseCookie, maxAge: 15 * 60_000 });
      response.set('Cache-Control', 'no-store');
      response.status(200).json({ csrfToken: tokenFor(nonce, readSessionCookie(request, options), options.csrfKey) });
    },
    requireCsrf(request: Request, response: Response, next: NextFunction): void {
      const nonce = cookieValue(request, cookieName('csrf', options.cookieSecure));
      const token = request.get('X-CSRF-Token');
      if (request.get('Origin') !== options.allowedOrigin || !nonce || !/^[a-f0-9]{64}$/i.test(nonce) ||
          !token || !/^[a-f0-9]{64}$/i.test(token)) {
        sendIdentityError(response, 403, 'FORBIDDEN', 'Solicitud no autorizada');
        return;
      }
      const expected = tokenFor(nonce, readSessionCookie(request, options), options.csrfKey);
      if (!timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'))) {
        sendIdentityError(response, 403, 'FORBIDDEN', 'Solicitud no autorizada');
        return;
      }
      next();
    },
    setSession(response: Response, secret: string): void {
      response.cookie(cookieName('session', options.cookieSecure), secret, { ...baseCookie, maxAge: 8 * 60 * 60_000 });
    },
    clearSession(response: Response): void {
      response.clearCookie(cookieName('session', options.cookieSecure), baseCookie);
    },
  };
}

/** For local loopback only; a later trusted-proxy deployment needs an explicit IP policy. */
export function localClientIp(request: Request): string {
  return request.socket.remoteAddress ?? 'unknown-local';
}
