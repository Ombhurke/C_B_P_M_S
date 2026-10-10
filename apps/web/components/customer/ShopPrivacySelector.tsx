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
}

export default function ShopPrivacySelector({
  accessMode,
  onModeChange,
  session,
}: ShopPrivacySelectorProps) {
  return (
    <section className="glass-panel rounded-3xl border border-white/10 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#fbf9f5]">
            Choose Document Privacy Mode
          </h2>
          <p className="text-xs text-neutral-300 mt-0.5">
            Decide whether this document is temporary or saved to your personal desktop library.
          </p>
        </div>
        <Link
          href="/account"
          className="text-xs text-[#ea7c50] hover:text-[#f3a261] font-medium transition-colors hidden sm:inline"
        >
          My Workspace →
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label
          className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
            accessMode === 'anonymous'
              ? 'border-[#ea7c50] bg-[#ea7c50]/15 ring-1 ring-[#ea7c50]/40'
              : 'border-white/10 bg-[#231a14]/40 hover:bg-[#231a14]/70 hover:border-white/20'
          }`}
        >
          <input
            type="radio"
            name="access-mode"
            checked={accessMode === 'anonymous'}
            onChange={() => onModeChange('anonymous')}
            className="sr-only"
          />
          <div className="flex items-center gap-2 text-sm font-bold text-[#fbf9f5]">
            <Shield className="w-4 h-4 text-[#ea7c50]" />
            <span>Anonymous Walk-In Job</span>
          </div>
          <span className="block text-xs text-neutral-300 mt-2 leading-relaxed">
            No account needed. A release PIN is issued after verified payment. Temporary documents are deleted after printing or expiry.
          </span>
        </label>

        <label
          className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
            accessMode === 'account'
              ? 'border-[#f3a261] bg-[#f3a261]/15 ring-1 ring-[#f3a261]/40'
              : 'border-white/10 bg-[#231a14]/40 hover:bg-[#231a14]/70 hover:border-white/20'
          }`}
        >
          <input
            type="radio"
            name="access-mode"
            checked={accessMode === 'account'}
            onChange={() => onModeChange('account')}
            className="sr-only"
          />
          <div className="flex items-center gap-2 text-sm font-bold text-[#fbf9f5]">
            <FolderLock className="w-4 h-4 text-[#f3a261]" />
            <span>Account-Linked Job</span>
          </div>
          <span className="block text-xs text-neutral-300 mt-2 leading-relaxed">
            Save this document into your private workspace library for re-printing at any CBPMS station anytime.
          </span>
        </label>
      </div>

      {accessMode === 'account' && !session && (
        <div className="pt-2">
          <CustomerAuthPanel compact />
        </div>
      )}

      {accessMode === 'account' && session && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center justify-between">
          <span>Signed in as <strong>{session.user.username}</strong>. Linked to your desktop workspace.</span>
          <Link href="/account" className="underline hover:text-white">View Library</Link>
        </div>
      )}
    </section>
  );
}
