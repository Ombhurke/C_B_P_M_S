import { NextRequest, NextResponse } from 'next/server';
import { authClient, verifiedSession } from '@/lib/server/supabase';
import { appOrigin } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const redirect = (ok: boolean) => NextResponse.redirect(new URL(ok ? '/account' : '/account?auth_error=failed', appOrigin()), 303);
  let finish = (response: NextResponse) => response;
  try {
    const auth = authClient(request);
    finish = auth.finish;
    const { client } = auth;
    const code = request.nextUrl.searchParams.get('code');
    if (!code || code.length > 4096 || request.nextUrl.searchParams.has('error')) return finish(redirect(false));
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error || !await verifiedSession(client)) return finish(redirect(false));
    return finish(redirect(true));
  } catch {
    return finish(redirect(false));
  }
}
