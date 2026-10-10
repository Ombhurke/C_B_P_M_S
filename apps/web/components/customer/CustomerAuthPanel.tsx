'use client';

import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useCustomerAuth } from './CustomerAuthContext';
import EmailAuthForm from './EmailAuthForm';
import GoogleOAuthButton from './GoogleOAuthButton';

interface CustomerAuthPanelProps {
  compact?: boolean;
  initialMode?: 'login' | 'signup';
}

export default function CustomerAuthPanel({
  compact = false,
  initialMode = 'login',
}: CustomerAuthPanelProps) {
  const { session, loading, error: contextError, refresh } = useCustomerAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [alias, setAlias] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_error')) {
      setErrorMsg('Google sign-in was not completed. Please try again.');
      window.history.replaceState(null, '', window.location.pathname);
    }
    if (params.get('mode') === 'signup') {
      setMode('signup');
    }
  }, []);

  if (session) {
    return (
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        <span>Signed in as <strong>{session.user.alias || session.user.username}</strong></span>
      </div>
    );
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('Passwords do not match');
      return;
    }

    setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const bodyPayload = mode === 'login'
        ? { email, password }
        : { email, password, alias: alias.trim() || undefined };
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || `Failed to ${mode === 'login' ? 'sign in' : 'create account'}`);
      }

      if (data.needsConfirmation) {
        setSuccessMsg(data.message || 'Account created! Please check your email to confirm your account.');
      } else {
        await refresh();
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const activeError = errorMsg || contextError;

  return (
    <div className={compact ? 'rounded-3xl border border-white/15 bg-[#231a14] p-6 space-y-5 text-left' : 'w-full space-y-6 text-left'}>
      {/* Top Header Badge */}
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#ea7c50]">
          <ShieldCheck className="w-4 h-4 text-[#ea7c50]" />
          <span>Customer Workspace</span>
        </div>
        <span className="text-[11px] font-mono text-neutral-400 uppercase">Secure Auth</span>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-2xl bg-[#14100e] border border-white/10">
        <button
          type="button"
          onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'login'
              ? 'bg-[#ea7c50] text-white shadow-md shadow-[#ea7c50]/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Sign In
        </button>
        <button
          type="button"
          onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
          className={`py-2 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
            mode === 'signup'
              ? 'bg-[#ea7c50] text-white shadow-md shadow-[#ea7c50]/20'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Sign Up
        </button>
      </div>

      <div>
        <h2 className="text-xl sm:text-2xl font-black text-[#fbf9f5] tracking-tight">
          {mode === 'login' ? 'Welcome Back' : 'Create Your Account'}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-300 mt-1 leading-relaxed">
          {mode === 'login'
            ? 'Sign in to access your private document library and counter history.'
            : 'One secure account to organize your documents across all CBPMS print stations.'}
        </p>
      </div>

      {/* Error / Success Feedback */}
      {activeError && (
        <div className="p-3.5 rounded-2xl bg-[#451a1a]/80 border border-[#f87171]/30 text-xs text-[#fca5a5] flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#f87171] flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{activeError}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/80 border border-emerald-500/30 text-xs text-emerald-300 flex items-start gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          <span className="leading-relaxed">{successMsg}</span>
        </div>
      )}

      {/* Email & Password Form */}
      <EmailAuthForm
        mode={mode}
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        alias={alias}
        setAlias={setAlias}
        busy={busy}
        loading={loading}
        onSubmit={handleEmailAuth}
      />

      {/* Divider */}
      <div className="flex items-center my-4">
        <div className="flex-1 border-t border-white/10" />
        <span className="px-3 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
          or continue with
        </span>
        <div className="flex-1 border-t border-white/10" />
      </div>

      {/* Google OAuth Button */}
      <GoogleOAuthButton
        label={mode === 'login' ? 'Sign In with Google' : 'Sign Up with Google'}
        disabled={busy || loading}
        onInitiate={() => setBusy(true)}
      />

      {/* Bottom Switcher Note */}
      <p className="text-center text-xs text-neutral-400 pt-2">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('signup'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-[#ea7c50] hover:underline font-semibold cursor-pointer"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
              className="text-[#ea7c50] hover:underline font-semibold cursor-pointer"
            >
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
