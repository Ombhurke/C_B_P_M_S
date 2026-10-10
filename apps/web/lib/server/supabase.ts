import 'server-only';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { appOrigin } from './policy';

export function authClient(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || new URL(url).protocol !== 'https:') throw new Error('Authentication is not configured');
  const pending = new Map<string, { name: string; value: string; options: CookieOptions }>();
  const cacheHeaders: Record<string, string> = {};
  const security = { httpOnly: true, secure: appOrigin().startsWith('https:'), sameSite: 'lax' as const, path: '/' };
  const allCookies = request.cookies.getAll();
  const hasSessionCookie = allCookies.some(c => c.name.startsWith('sb-') || c.name.includes('auth-token'));

  const authCookieParts = allCookies
    .filter(c => c.name.startsWith('sb-') || c.name.includes('auth-token'))
    .map(c => `${c.name}=${c.value}`)
    .sort()
    .join(';');
  const sessionKey = authCookieParts || undefined;

  const client = createServerClient(url, key, {
    cookieOptions: { ...security, maxAge: 60 * 60 * 24 * 7 },
    cookies: {
      getAll: () => allCookies,
      setAll: (cookies, headers) => {
        Object.assign(cacheHeaders, headers);
        for (const cookie of cookies) {
          request.cookies.set(cookie.name, cookie.value);
          pending.set(cookie.name, cookie);
        }
      },
    },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000), cache: 'no-store' }) },
  });
  const finish = (response: NextResponse) => {
    for (const cookie of pending.values()) response.cookies.set(cookie.name, cookie.value, { ...cookie.options, ...security });
    for (const [key, value] of Object.entries(cacheHeaders)) response.headers.set(key, value);
    response.headers.set('Cache-Control', 'private, no-store');
    response.headers.set('Referrer-Policy', 'no-referrer');
    return response;
  };
  return { client, finish, hasSessionCookie, sessionKey };
}

const _SESSION_CACHE = new Map<string, { session: any; expiresAt: number }>();

export function clearSessionCache() {
  _SESSION_CACHE.clear();
}

export async function verifiedSession(
  client: ReturnType<typeof authClient>['client'],
  hasSessionCookie: boolean = true,
  sessionKey?: string,
) {
  if (!hasSessionCookie) return null;
  if (sessionKey) {
    const cached = _SESSION_CACHE.get(sessionKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.session;
    }
  }
  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) {
    if (error && error.status && error.status >= 500) throw new Error('Authentication service unavailable');
    return null;
  }
  const appMetadata = data.user.app_metadata || {};
  const providers: string[] = appMetadata.providers || (appMetadata.provider ? [appMetadata.provider] : []);
  const hasSupportedProvider = providers.some(p => p === 'google' || p === 'email');
  if (!data.user.email_confirmed_at || !hasSupportedProvider) return null;
  // getUser above is authoritative; getSession here only retrieves the refreshed token.
  const result = await client.auth.getSession();
  if (result.error || !result.data.session) return null;
  if (sessionKey) {
    if (_SESSION_CACHE.size > 200) _SESSION_CACHE.clear();
    _SESSION_CACHE.set(sessionKey, { session: result.data.session, expiresAt: Date.now() + 20_000 });
  }
  return result.data.session;
}
