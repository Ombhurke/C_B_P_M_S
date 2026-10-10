import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/server/supabase';
import { sameOrigin } from '@/lib/server/policy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ detail: 'Invalid request origin' }, { status: 403 });
  }

  let finish = (response: NextResponse) => response;
  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email and password are required' }, { status: 400 });
    }

    const auth = authClient(request);
    finish = auth.finish;

    const { data, error } = await auth.client.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if ((error as any).code === 'email_provider_disabled') {
        return finish(NextResponse.json({
          detail: 'Email logins are disabled in Supabase. Please enable the Email provider in Supabase Dashboard → Authentication → Providers, or sign in with Google.',
        }, { status: 422 }));
      }
      return finish(NextResponse.json({
        detail: error.message || 'Invalid email or password',
      }, { status: error.status || 401 }));
    }

    if (!data.user) {
      return finish(NextResponse.json({ detail: 'Could not authenticate user' }, { status: 401 }));
    }

    return finish(NextResponse.json({
      ok: true,
      session: {
        user: {
          id: data.user.id,
          username: data.user.email,
          role: 'customer',
        },
      },
    }));
  } catch {
    return finish(NextResponse.json({ detail: 'Sign-in service is temporarily unavailable. Please try again.' }, { status: 500 }));
  }
}
