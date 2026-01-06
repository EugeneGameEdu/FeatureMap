import type { IncomingHttpHeaders } from 'http';
import type { NextFunction, Request, Response } from 'express';

const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1']);

function normalizeHeader(header: string | string[] | undefined): string | undefined {
  if (!header) {
    return undefined;
  }

  return Array.isArray(header) ? header[0] : header;
}

function parseHost(hostHeader: string | undefined): string | null {
  if (!hostHeader) {
    return null;
  }

  if (hostHeader.startsWith('[')) {
    const closingIndex = hostHeader.indexOf(']');
    return closingIndex === -1 ? null : hostHeader.slice(1, closingIndex);
  }

  const [host] = hostHeader.split(':');
  return host || null;
}

function parseOrigin(originHeader: string): string | null {
  if (originHeader === 'null') {
    return null;
  }

  try {
    return new URL(originHeader).hostname;
  } catch {
    return null;
  }
}

function isAllowedHost(hostname: string | null): boolean {
  return hostname !== null && ALLOWED_HOSTS.has(hostname);
}

export function enforceLocalhost(req: Request, res: Response, next: NextFunction): void {
  if (!isLocalhostRequest(req.headers)) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  next();
}

export function isLocalhostRequest(headers: IncomingHttpHeaders): boolean {
  const hostHeader = parseHost(normalizeHeader(headers.host));
  if (!isAllowedHost(hostHeader)) {
    return false;
  }

  const originHeader = normalizeHeader(headers.origin);
  if (originHeader) {
    const originHost = parseOrigin(originHeader);
    if (!isAllowedHost(originHost)) {
      return false;
    }
  }

  return true;
}

export function requireToken(sessionToken: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const token = req.header('x-featuremap-token');

    if (!token || token !== sessionToken) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    next();
  };
}
