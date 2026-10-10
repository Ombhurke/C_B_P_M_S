'use client';

import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, ArrowRight, User } from 'lucide-react';

interface EmailAuthFormProps {
  mode: 'login' | 'signup';
  email: string;
  setEmail: (val: string) => void;
  password: string;
  setPassword: (val: string) => void;
  confirmPassword: string;
  setConfirmPassword: (val: string) => void;
  alias?: string;
  setAlias?: (val: string) => void;
  busy: boolean;
  loading: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function EmailAuthForm({
  mode,
  email,
  setEmail,
  password,
  setPassword,
  confirmPassword,
  setConfirmPassword,
  alias,
  setAlias,
  busy,
  loading,
  onSubmit,
}: EmailAuthFormProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === 'signup' && (
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Your Alias / Display Name <span className="text-neutral-500 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              maxLength={32}
              value={alias || ''}
              onChange={(e) => setAlias?.(e.target.value)}
              placeholder="e.g. Alex (defaults to first 6 letters of email)"
              className="w-full bg-[#14100e] border border-white/15 focus:border-[#ea7c50] text-[#fbf9f5] text-xs sm:text-sm pl-10 pr-4 py-3 rounded-xl focus:outline-none transition-colors"
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full bg-[#14100e] border border-white/15 focus:border-[#ea7c50] text-[#fbf9f5] text-xs sm:text-sm pl-10 pr-4 py-3 rounded-xl focus:outline-none transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-neutral-300 mb-1.5">
          Password
        </label>
        <div className="relative">
          <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === 'signup' ? 'At least 6 characters' : '••••••••'}
            className="w-full bg-[#14100e] border border-white/15 focus:border-[#ea7c50] text-[#fbf9f5] text-xs sm:text-sm pl-10 pr-10 py-3 rounded-xl focus:outline-none transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {mode === 'signup' && (
        <div>
          <label className="block text-xs font-medium text-neutral-300 mb-1.5">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={6}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full bg-[#14100e] border border-white/15 focus:border-[#ea7c50] text-[#fbf9f5] text-xs sm:text-sm pl-10 pr-4 py-3 rounded-xl focus:outline-none transition-colors"
            />
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || loading}
        className="w-full py-3.5 px-4 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-[#ea7c50]/20 disabled:opacity-50 transition-all cursor-pointer"
      >
        <span>
          {busy ? 'Processing…' : mode === 'login' ? 'Sign In with Email' : 'Create Account'}
        </span>
        <ArrowRight className="w-4 h-4" />
      </button>
    </form>
  );
}
