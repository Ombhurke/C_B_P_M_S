import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Store, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      {/* Neutral Signed-Out Navigation (Visual 09) */}
      <header className="w-full bg-[#231713] text-[#f7f4ee] border-b border-black/30 sticky top-0 z-40 shadow-sm">
        <div className="w-full px-[clamp(24px,3.2vw,88px)] flex items-center justify-between h-20 sm:h-22">
          <div className="flex items-center gap-8 lg:gap-14 h-full">
            <Link
              href="/"
              className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f4ee] hover:text-white transition-colors flex items-center gap-1"
            >
              <span>CBPMS</span>
              <span className="text-[#c05634]">.</span>
            </Link>

            <nav className="flex items-center gap-6 sm:gap-9 h-full" aria-label="Navigation">
              <Link
                href="/"
                className="h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide text-[#d4c8bd] hover:text-white transition-colors"
              >
                Home
              </Link>
              <Link
                href="/shops"
                className="h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide text-[#d4c8bd] hover:text-white transition-colors"
              >
                Find a shop
              </Link>
              <Link
                href="/help"
                className="h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide text-[#d4c8bd] hover:text-white transition-colors"
              >
                Help
              </Link>
            </nav>
          </div>

          <div>
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Main Asymmetric Two-Column Content */}
      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-16 sm:py-24 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Left Column: Copy & Actions (7 cols) */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <span className="inline-block px-3.5 py-1 rounded-full bg-[#fdf3ea] border border-[#f5d0b5] text-[#c05634] font-mono text-xs font-bold uppercase tracking-widest">
              404
            </span>

            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-serif text-[#241814] font-normal tracking-tight leading-tight">
              This page isn’t here.
            </h1>

            <p className="text-lg sm:text-xl text-[#66554b] max-w-xl leading-relaxed">
              The link may have changed, or the page may no longer be available.
            </p>

            <div className="pt-4 flex flex-wrap items-center gap-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 px-8 py-4 min-h-[52px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-lg shadow-[#c05634]/25 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Return home</span>
              </Link>

              <Link
                href="/shops"
                className="inline-flex items-center gap-2 px-8 py-4 min-h-[52px] rounded-2xl border-2 border-[#dcd4c8] bg-white hover:bg-neutral-50 text-[#3d2f28] text-base font-semibold transition-colors cursor-pointer"
              >
                <Store className="w-5 h-5" />
                <span>Find a shop</span>
              </Link>

              <Link
                href="/help"
                className="inline-flex items-center gap-1.5 text-base font-semibold text-[#c05634] hover:underline px-2 py-2"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Need help?</span>
              </Link>
            </div>
          </div>

          {/* Right Column: Flat Paper Folder Illustration (5 cols) */}
          <div className="lg:col-span-5 flex items-center justify-center">
            <div className="relative w-72 sm:w-88 h-64 sm:h-80">
              {/* Back Folder Sheet */}
              <div className="absolute inset-0 bg-[#e8dfd2] rounded-3xl transform rotate-[-4deg] shadow-sm border border-[#dcd4c8]" />
              {/* Middle Paper Sheet */}
              <div className="absolute inset-2 bg-white rounded-3xl transform rotate-[2deg] shadow-md border border-[#e6dfd5] p-6 flex flex-col justify-between">
                <div className="space-y-3 opacity-60">
                  <div className="w-20 h-3 bg-[#c05634]/50 rounded" />
                  <div className="w-full h-2 bg-[#d4c8bb] rounded" />
                  <div className="w-4/5 h-2 bg-[#d4c8bb] rounded" />
                  <div className="w-3/5 h-2 bg-[#d4c8bb] rounded" />
                </div>
                <div className="self-end text-xs font-mono font-bold text-[#c05634]">
                  CBPMS
                </div>
              </div>
              {/* Terracotta Folder Tab */}
              <div className="absolute -top-3 left-10 px-4 py-1.5 rounded-t-xl bg-[#c05634] text-white text-[11px] font-mono uppercase tracking-wider font-bold shadow-xs">
                MISSING
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Light Divider & Footer */}
      <footer className="w-full border-t border-[#e6dfd5] py-6 px-[clamp(24px,3.2vw,88px)] text-center text-xs text-[#8c7b70]">
        CBPMS · Cloud printing, simplified
      </footer>
    </div>
  );
}
