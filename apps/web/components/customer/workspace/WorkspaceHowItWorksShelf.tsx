'use client';

import React from 'react';
import Link from 'next/link';
import { UploadCloud, Store, KeyRound, ArrowRight } from 'lucide-react';

export default function WorkspaceHowItWorksShelf() {
  return (
    <section aria-label="How touchless printing works" className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-2xl sm:text-3xl font-serif text-[#241814] font-bold tracking-tight">
          How CBPMS touchless printing works
        </h2>
        <Link
          href="/help"
          className="text-sm sm:text-base font-semibold text-[#c05634] hover:text-[#a94829] inline-flex items-center gap-1.5 transition-colors"
        >
          <span>Learn more about formats & limits</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Step 1 */}
        <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <UploadCloud className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-bold text-[#241814]">
              1. Store in private cloud
            </h3>
            <p className="text-sm sm:text-base text-[#66554b] leading-relaxed">
              Upload PDFs and images to your personal library. We calculate page count and enforce size validation so your documents are ready to print.
            </p>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#8c7b70] pt-2 border-t border-[#f2ede6]">
            Step 1 • Document Library
          </span>
        </div>

        {/* Step 2 */}
        <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-bold text-[#241814]">
              2. Choose your counter
            </h3>
            <p className="text-sm sm:text-base text-[#66554b] leading-relaxed">
              Locate an active campus or commercial print shop. Configure copies, colour or black & white, and view transparent per-page rates.
            </p>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#8c7b70] pt-2 border-t border-[#f2ede6]">
            Step 2 • Counter Directory
          </span>
        </div>

        {/* Step 3 */}
        <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <KeyRound className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-serif font-bold text-[#241814]">
              3. Release with 6-digit code
            </h3>
            <p className="text-sm sm:text-base text-[#66554b] leading-relaxed">
              Receive a private 6-digit release code. At the counter, key in the code or let the operator spool your job with zero physical USB thumbdrives.
            </p>
          </div>
          <span className="text-xs font-mono uppercase tracking-wider text-[#8c7b70] pt-2 border-t border-[#f2ede6]">
            Step 3 • Instant Pickup
          </span>
        </div>
      </div>
    </section>
  );
}
