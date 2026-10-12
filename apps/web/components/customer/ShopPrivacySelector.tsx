'use client';

import React from 'react';
import Link from 'next/link';
import { AccessMode } from '@/lib/types';
import CustomerAuthPanel from './CustomerAuthPanel';
import { Shield, FolderLock } from 'lucide-react';

interface ShopPrivacySelectorProps {
  accessMode: AccessMode;
  onModeChange: (mode: AccessMode) => void;
  session: any;
  shopId?: string;
}

export default function ShopPrivacySelector({
  accessMode,
  onModeChange,
  session,
  shopId,
}: ShopPrivacySelectorProps) {
  const returnPath = shopId ? `/shop/${encodeURIComponent(shopId)}` : '/shops';

  return (
    <section className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 space-y-5 shadow-sm text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#8c7b70]">
            Privacy &amp; storage choice
          </h2>
          <p className="text-base text-[#241814] font-medium mt-0.5">
            Choose whether this document is temporary or saved to your library.
          </p>
        </div>
        {session && (
          <Link
            href="/account/documents"
            className="text-xs sm:text-sm font-semibold text-[#c05634] hover:underline transition-colors inline-flex items-center gap-1"
          >
            My library →
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label
          className={`cursor-pointer rounded-2xl border-2 p-5 transition-all text-left flex flex-col justify-between ${
            accessMode === 'anonymous'
              ? 'border-[#c05634] bg-[#fdf3ea] shadow-xs'
              : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/50'
          }`}
        >
          <input
            type="radio"
            name="access-mode"
            checked={accessMode === 'anonymous'}
            onChange={() => onModeChange('anonymous')}
            className="sr-only"
          />
          <div>
            <div className="flex items-center gap-2.5 text-base font-bold text-[#241814]">
              <Shield className={`w-5 h-5 ${accessMode === 'anonymous' ? 'text-[#c05634]' : 'text-[#8c7b70]'}`} />
              <span>Anonymous job</span>
            </div>
            <p className="text-sm text-[#66554b] mt-2 leading-relaxed">
              Temporary files. No account needed. Files are removed after printing or expiry.
            </p>
          </div>
          <span className="mt-3 text-xs font-semibold text-[#8c7b70] uppercase tracking-wider">
            Never stored in library
          </span>
        </label>

        <label
          className={`cursor-pointer rounded-2xl border-2 p-5 transition-all text-left flex flex-col justify-between ${
            accessMode === 'account'
              ? 'border-[#c05634] bg-[#fdf3ea] shadow-xs'
              : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/50'
          }`}
        >
          <input
            type="radio"
            name="access-mode"
            checked={accessMode === 'account'}
            onChange={() => onModeChange('account')}
            className="sr-only"
          />
          <div>
            <div className="flex items-center gap-2.5 text-base font-bold text-[#241814]">
              <FolderLock className={`w-5 h-5 ${accessMode === 'account' ? 'text-[#c05634]' : 'text-[#8c7b70]'}`} />
              <span>Account-linked job</span>
            </div>
            <p className="text-sm text-[#66554b] mt-2 leading-relaxed">
              Save in your private library. Re-print anytime from your private customer shelf.
            </p>
          </div>
          <span className="mt-3 text-xs font-semibold text-[#c05634] uppercase tracking-wider">
            {session ? 'Linked to your account' : 'Requires sign in'}
          </span>
        </label>
      </div>

      {accessMode === 'account' && !session && (
        <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-[#66554b]">
            <p className="font-semibold text-[#241814]">Sign in to link this job to your library</p>
            <p className="mt-0.5">Use your existing sign-in to keep this file in your personal shelf.</p>
          </div>
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnPath)}`}
            className="inline-flex items-center justify-center px-5 py-2.5 min-h-[44px] rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold transition-all whitespace-nowrap shadow-xs"
          >
            Sign in now
          </Link>
        </div>
      )}

      {accessMode === 'account' && session && (
        <div className="p-3.5 rounded-2xl bg-[#f0f9f3] border border-[#cbe8d5] text-xs sm:text-sm text-[#1e613b] flex items-center justify-between">
          <span>Signed in as <strong>{session.user.alias || session.user.username}</strong>. Linked to your private library.</span>
          <Link href="/account/documents" className="font-semibold underline hover:text-[#134227]">View library</Link>
        </div>
      )}
    </section>
  );
}
