import 'server-only';

function configuredValue(name: 'APP_ORIGIN' | 'BACKEND_API_URL', developmentDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (process.env.NODE_ENV === 'production') throw new Error(`${name} must be configured in production`);
  return developmentDefault;
}

function allowedProtocol(url: URL): boolean {
  if (url.protocol === 'https:') return true;
  return process.env.NODE_ENV !== 'production' && url.protocol === 'http:' &&
    ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

export function appOrigin(): string {
  const url = new URL(configuredValue('APP_ORIGIN', 'http://localhost:3000'));
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !allowedProtocol(url)) {
    throw new Error('APP_ORIGIN must be an HTTPS origin (HTTP is allowed on loopback only)');
  }
  return url.origin;
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const secFetchSite = request.headers.get('sec-fetch-site');

  if (secFetchSite === 'cross-site' || secFetchSite === 'same-site') return false;

  const expected = appOrigin();
  try {
    const candidate = origin || (referer ? new URL(referer).origin : null);
    if (!candidate) return false;
    if (candidate === expected) return true;
    if (process.env.NODE_ENV === 'production') return false;
    const candidateUrl = new URL(candidate);
    const expectedUrl = new URL(expected);
    const isLoopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);

    if (isLoopback(candidateUrl.hostname) && isLoopback(expectedUrl.hostname)) {
      if (candidateUrl.protocol === expectedUrl.protocol && candidateUrl.port === expectedUrl.port) return true;
    }
  } catch {}

  return false;
}

// Deliberate public surface, not an arbitrary reverse proxy. Desktop-only routes stay private.
export function allowedRoute(method: string, parts: string[]): boolean {
  if (!parts.length || parts.some(part => !/^[a-zA-Z0-9_-]{1,128}$/.test(part))) return false;
  const path = parts.join('/');
  const rules: Record<string, RegExp[]> = {
    GET: [
      /^shops(?:\/[\w-]+(?:\/(?:printers|stations|team|activity|jobs\/[\w-]+))?)?$/,
      /^jobs\/(?:queue|summary)\/[\w-]+$/,
      /^jobs\/[\w-]+\/status$/,
      /^customer\/(?:documents|jobs)(?:\/[\w-]+)?$/,
      /^customer\/documents\/[\w-]+\/download$/,
      /^customer\/storage-usage$/,
      /^uploads\/policy$/,
      /^uploads\/batches\/[\w-]+$/,
    ],
    POST: [
      /^auth\/(?:login|logout|users)$/,
      /^jobs\/(?:calculate-cost|stage|stage-folder)$/,
      /^payments\/[\w-]+\/(?:order|verify|pay-at-counter)$/,
      /^customer\/documents(?:\/batch)?$/,
      /^shops\/[\w-]+\/(?:printers|stations|team)$/,
      /^shops\/[\w-]+\/jobs\/[\w-]+\/reject$/,
      /^uploads\/guest-session$/,
      /^uploads\/batches$/,
      /^uploads\/items\/[\w-]+\/(?:permission|complete)$/,
      /^uploads\/batches\/[\w-]+\/(?:finalize|cancel)$/,
    ],
    PATCH: [
      /^shops\/[\w-]+(?:\/(?:profile|printers\/[\w-]+|stations\/[\w-]+))?$/,
      /^customer\/alias$/,
    ],
    DELETE: [
      /^customer\/documents\/[\w-]+$/,
    ],
  };
  return (rules[method] || []).some(rule => rule.test(path));
}

export function backendBase(): string {
  const url = new URL(configuredValue('BACKEND_API_URL', 'http://127.0.0.1:8000/api/v1'));
  if (url.username || url.password || url.search || url.hash || url.pathname.replace(/\/$/, '') !== '/api/v1' ||
      !allowedProtocol(url)) {
    throw new Error('Invalid backend configuration');
  }
  return url.href.replace(/\/$/, '');
}
