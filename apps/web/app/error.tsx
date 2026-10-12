'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft, AlertCircle, HelpCircle, Home } from 'lucide-react';

export default function GlobalErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      {/* Header */}
      <header className="w-full bg-[#231713] text-[#f7f4ee] border-b border-black/30 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-[clamp(24px,3.2vw,88px)] flex items-center justify-between h-20 sm:h-22">
          <Link
            href="/account"
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f4ee] hover:text-white transition-colors flex items-center gap-1"
          >
            <span>CBPMS</span>
            <span className="text-[#c05634]">.</span>
          </Link>
          <Link
            href="/account"
            className="text-sm font-semibold text-[#d4c8bd] hover:text-white transition-colors"
          >
            Return to workspace →
          </Link>
        </div>
      </header>

      {/* Main Error Canvas (Visual 10) */}
      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-12 sm:py-16 space-y-8 text-left">
        {/* Breadcrumb & Title */}
        <div>
          <div className="text-xs text-[#8c7b70] mb-2 font-medium">
            My prints / Service error
          </div>
          <h1 className="text-3xl sm:text-5xl font-serif text-[#241814] font-normal tracking-tight">
            We couldn’t load this page.
          </h1>
          <p className="text-base sm:text-lg text-[#66554b] mt-2 max-w-xl leading-relaxed">
            Please try again. If the problem continues, return to your workspace.
          </p>
        </div>

        {/* Two-Column Asymmetric Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Broad Card: Primary Recovery (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-[#e6dfd5] p-8 sm:p-10 shadow-xs space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <AlertCircle className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                Your request could not be completed.
              </h2>
              <p className="text-sm sm:text-base text-[#66554b] leading-relaxed">
                The service encountered an issue while retrieving this view. No records were modified and you can safely retry or return to your account shelf.
              </p>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex items-center gap-2.5 px-8 py-3.5 min-h-[50px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
              >
                <RefreshCw className="w-5 h-5" />
                <span>Try again</span>
              </button>

              <Link
                href="/account"
                className="inline-flex items-center gap-2 px-6 py-3.5 min-h-[50px] rounded-2xl border-2 border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-base font-semibold transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Return to workspace</span>
              </Link>
            </div>
          </div>

          {/* Right Smaller Card: While you wait (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#8c7b70]">
              While you wait
            </h3>

            <div className="space-y-3 pt-1">
              <Link
                href="/help"
                className="w-full p-4 rounded-2xl border border-[#e6dfd5] hover:border-[#c05634]/50 hover:bg-[#faf6f0] flex items-center gap-3 transition-colors text-sm font-semibold text-[#241814]"
              >
                <HelpCircle className="w-5 h-5 text-[#c05634] flex-shrink-0" />
                <span>Get help &amp; view FAQs</span>
              </Link>

              <Link
                href="/"
                className="w-full p-4 rounded-2xl border border-[#e6dfd5] hover:border-[#c05634]/50 hover:bg-[#faf6f0] flex items-center gap-3 transition-colors text-sm font-semibold text-[#241814]"
              >
                <Home className="w-5 h-5 text-[#8c7b70] flex-shrink-0" />
                <span>Return home</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-[#e6dfd5] py-6 px-[clamp(24px,3.2vw,88px)] text-center text-xs text-[#8c7b70]">
        CBPMS · Secure cloud printing
      </footer>
    </div>
  );
}
