import { NextRequest, NextResponse } from 'next/server';
import { authClient, verifiedSession } from '@/lib/server/supabase';
import { backendBase } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  let finish = (response: NextResponse) => response;
  try {
    const auth = authClient(request);
    finish = auth.finish;
    const session = await verifiedSession(auth.client, auth.hasSessionCookie, auth.sessionKey);
    if (!session) return finish(NextResponse.json({ session: null }));
    const response = await fetch(backendBase() + '/auth/me', {
      headers: { Authorization: 'Bearer ' + session.access_token },
      cache: 'no-store', redirect: 'manual', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return finish(NextResponse.json({ detail: response.status === 403 ? 'This CBPMS account is disabled.' : 'Your workspace is unavailable. Please try again.' }, { status: response.status === 403 ? 403 : 503 }));
    const user = await response.json();
    const userAlias = user.alias || (typeof user.username === 'string' ? user.username.slice(0, 6) : undefined);
    return finish(NextResponse.json({ session: { user: { id: user.id, username: user.username, alias: userAlias, alias_chosen: Boolean(user.alias_chosen), shop_id: null, role: 'customer' } } }));
  } catch {
    return finish(NextResponse.json({ detail: 'Sign-in service is temporarily unavailable. Please try again.' }, { status: 503 }));
  }
}
