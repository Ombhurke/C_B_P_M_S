import { NextRequest, NextResponse } from 'next/server';
import { authClient, verifiedSession } from '@/lib/server/supabase';
import { allowedRoute, backendBase, sameOrigin } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';
const LIMIT = 26 * 1024 * 1024;
async function boundedBody(request: NextRequest): Promise<ArrayBuffer | undefined> {
  if (!request.body) return undefined;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > LIMIT) { await reader.cancel(); throw new RangeError('Request too large'); }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.length; }
  return body.buffer;
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  if (!allowedRoute(request.method, path)) return NextResponse.json({ detail: 'Not found' }, { status: 404 });
  if (request.method !== 'GET' && request.nextUrl.search) return NextResponse.json({ detail: 'Query parameters not allowed' }, { status: 400 });
  if (request.method !== 'GET' && !sameOrigin(request)) return NextResponse.json({ detail: 'Invalid request origin' }, { status: 403 });
  if (Number(request.headers.get('content-length') || 0) > LIMIT) return NextResponse.json({ detail: 'Upload is too large' }, { status: 413 });
  let finish = (response: NextResponse) => response;
  try {
    const headers = new Headers();
    for (const key of ['content-type', 'x-checkout-token']) {
      const value = request.headers.get(key);
      if (value) headers.set(key, value);
    }
    const staffToken = request.headers.get('authorization');
    if (staffToken && /^Bearer [A-Za-z0-9_-]{43}$/.test(staffToken)) {
      headers.set('authorization', staffToken);
    } else {
      const auth = authClient(request);
      finish = auth.finish;
      const session = await verifiedSession(auth.client, auth.hasSessionCookie, auth.sessionKey);
      if (session) headers.set('authorization', 'Bearer ' + session.access_token);
    }
    const queryString = request.method === 'GET' && request.nextUrl.search ? request.nextUrl.search : '';
    const response = await fetch(backendBase() + '/' + path.join('/') + queryString, {
      method: request.method, headers,
      body: request.method === 'GET' ? undefined : await boundedBody(request),
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(30000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = new URL(response.headers.get('location') || 'invalid');
      if (location.origin !== new URL(process.env.SUPABASE_URL!).origin || !location.pathname.startsWith('/storage/v1/object/sign/')) throw new Error('Invalid storage redirect');
      return finish(NextResponse.redirect(location, 303));
    }
    if (response.status >= 500) {
      return finish(NextResponse.json({ detail: 'This service is unavailable or not yet configured. Please try again later.' }, { status: 503 }));
    }
    const outgoing = new NextResponse(response.body, { status: response.status });
    for (const key of ['content-type', 'content-disposition']) {
      const value = response.headers.get(key);
      if (value) outgoing.headers.set(key, value);
    }
    outgoing.headers.set('Cache-Control', 'private, no-store');
    outgoing.headers.set('X-Content-Type-Options', 'nosniff');
    return finish(outgoing);
  } catch (error) {
    return finish(NextResponse.json({ detail: error instanceof RangeError ? 'Upload is too large' : 'This service is temporarily unavailable.' }, { status: error instanceof RangeError ? 413 : 503 }));
  }
}

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE };
