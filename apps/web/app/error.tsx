'use client';

import React from 'react';
import Link from 'next/link';
import { RefreshCw, ArrowLeft, AlertTriangle } from 'lucide-react';

export default function GlobalErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#14100e] text-[#fbf9f5] px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#ea7c50]/15 border border-[#ea7c50]/35 flex items-center justify-center text-[#ea7c50] mb-6 shadow-lg">
        <AlertTriangle className="w-7 h-7" />
      </div>
      <span className="font-mono text-xs uppercase tracking-widest text-[#ea7c50] mb-2 font-bold">
        Application Error
      </span>
      <h1 className="text-3xl font-extrabold tracking-tight mb-3">Something Went Wrong</h1>
      <p className="text-sm text-neutral-300 max-w-md mb-8 leading-relaxed font-normal">
        {error?.message || 'An unexpected error occurred while loading this counter station.'}
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white text-xs font-bold transition-all shadow-md shadow-[#ea7c50]/20 cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Try Again</span>
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/15 text-neutral-200 hover:text-white text-xs font-medium transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Home</span>
        </Link>
      </div>
    </div>
  );
}
