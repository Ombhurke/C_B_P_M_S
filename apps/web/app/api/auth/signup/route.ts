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
    const rawAlias = typeof body.alias === 'string' ? body.alias.trim() : '';
    const alias = rawAlias || email.slice(0, 6);

    if (!email || !password) {
      return NextResponse.json({ detail: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ detail: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const auth = authClient(request);
    finish = auth.finish;

    const { data, error } = await auth.client.auth.signUp({
      email,
      password,
      options: {
        data: {
          alias,
          alias_chosen: Boolean(rawAlias),
        },
      },
    });

    if (error) {
      if ((error as any).code === 'email_provider_disabled') {
        return finish(NextResponse.json({
          detail: 'Email registrations are disabled in Supabase. Please enable the Email provider in Supabase Dashboard → Authentication → Providers, or sign up with Google.',
        }, { status: 422 }));
      }
      return finish(NextResponse.json({
        detail: error.message || 'Could not create account',
      }, { status: error.status || 400 }));
    }

    if (!data.user) {
      return finish(NextResponse.json({ detail: 'Failed to create user account' }, { status: 400 }));
    }

    if (data.session) {
      return finish(NextResponse.json({
        ok: true,
        session: {
          user: {
            id: data.user.id,
            username: data.user.email,
            alias,
            alias_chosen: Boolean(rawAlias),
            role: 'customer',
          },
        },
      }));
    }

    return finish(NextResponse.json({
      ok: true,
      needsConfirmation: true,
      message: 'Account created! If email confirmation is enabled, please check your inbox to verify your account.',
    }));
  } catch {
    return finish(NextResponse.json({ detail: 'Registration service is temporarily unavailable. Please try again.' }, { status: 500 }));
  }
}
