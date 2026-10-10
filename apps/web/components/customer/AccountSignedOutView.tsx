'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, FolderLock } from 'lucide-react';
import CustomerAuthPanel from './CustomerAuthPanel';

interface AccountSignedOutViewProps {
  initialMode?: 'login' | 'signup';
}

export default function AccountSignedOutView({ initialMode = 'login' }: AccountSignedOutViewProps) {
  return (
    <main className="account-auth-page text-[#fbf9f5]">
      <div className="account-auth-header">
        <Link
          href="/"
          className="text-base text-neutral-300 hover:text-white inline-flex items-center gap-2 transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-[#ea7c50] group-hover:-translate-x-1 transition-transform" />
          <span>Return to Home</span>
        </Link>
      </div>

      <div className="account-auth-stage">
        <section className="account-auth-copy">
          <div className="account-auth-badge">
            <FolderLock className="w-5 h-5" />
            <span>Customer cloud workspace</span>
          </div>

          <h1>Keep your documents ready. Print when you are.</h1>

          <p className="account-auth-lead">
            Sign in to keep frequently printed files private, organized, and ready for any CBPMS counter.
          </p>

          <div className="account-auth-benefits">
            <div><CheckCircle2 /><span>Private document library isolated to your account</span></div>
            <div><CheckCircle2 /><span>Keep your saved files and print history together</span></div>
            <div><CheckCircle2 /><span>Anonymous walk-in printing remains available</span></div>
          </div>

          <Link href="/shops" className="account-auth-anonymous">
            <span>Find a shop without signing in</span>
            <ArrowRight />
          </Link>
        </section>

        <section className="account-auth-form-wrap" aria-label="Customer account access">
          <div className="workspace-auth">
            <CustomerAuthPanel initialMode={initialMode} />
          </div>
        </section>
      </div>
    </main>
  );
}
