import { NextRequest, NextResponse } from 'next/server';
import { authClient, clearSessionCache } from '@/lib/server/supabase';
import { sameOrigin } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';
export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ detail: 'Invalid request origin' }, { status: 403 });
  let finish = (response: NextResponse) => response;
  try {
    const auth = authClient(request);
    finish = auth.finish;
    const { error } = await auth.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
    clearSessionCache();
    return finish(NextResponse.json({ ok: true }));
  } catch {
    return finish(NextResponse.json({ detail: 'Sign out could not be completed. Please retry.' }, { status: 503 }));
  }
}
