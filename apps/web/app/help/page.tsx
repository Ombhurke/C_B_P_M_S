'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, ShieldCheck, FileText, Lock, Store } from 'lucide-react';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-14 py-8 sm:py-12 space-y-10">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#66554b] hover:text-[#241814] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to workspace</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#241814] font-normal tracking-tight">
            How CBPMS Printing Works
          </h1>
          <p className="text-base text-[#66554b] mt-1 max-w-2xl leading-relaxed">
            Everything you need to know about document limits, privacy isolation, and counter workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
          {/* Card 1: Supported Formats & Limits */}
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#241814]">Formats & Size Limits</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#66554b]">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>PDF:</strong> Unencrypted documents, 1 to 1,000 pages.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Images:</strong> PNG and JPEG files.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Maximum size:</strong> 25 MB per document.</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span>DOCX / Office files must be exported to PDF before upload.</span>
              </li>
            </ul>
          </div>

          {/* Card 2: Privacy Model */}
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#241814]">Privacy on Your Terms</h3>
            <ul className="space-y-2.5 text-xs sm:text-sm text-[#66554b]">
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Private Library:</strong> Files uploaded in your account are strictly isolated to your user ID.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Durable Deletion:</strong> Removing a document permanently deletes cloud storage objects.</span>
              </li>
              <li className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <span><strong>Anonymous Mode:</strong> Temporary files expire automatically and never link to an account.</span>
              </li>
            </ul>
          </div>

          {/* Card 3: Counter Availability */}
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <Store className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-[#241814]">Physical Counters</h3>
            <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
              We are currently in private beta onboarding our first partner print shops and campus counters.
            </p>
            <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
              You can organize reusable files in your private library right now. Counter printing and verified release PINs will activate as shop partners go live.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
