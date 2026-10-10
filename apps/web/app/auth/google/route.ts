import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/server/supabase';
import { appOrigin, sameOrigin } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: 'Invalid request origin' }, { status: 403 });
  const failure = () => NextResponse.redirect(new URL('/account?auth_error=unavailable', appOrigin()), 303);
  let finish = (response: NextResponse) => response;
  try {
    const auth = authClient(request);
    finish = auth.finish;
    const { client } = auth;
    const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: {
      redirectTo: appOrigin() + '/auth/callback', skipBrowserRedirect: true,
    } });
    if (error || !data.url) return finish(failure());
    return finish(NextResponse.redirect(data.url, 303));
  } catch {
    return finish(failure());
  }
}
