import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#14100e] text-[#fbf9f5] px-4 text-center">
      <div className="w-12 h-12 rounded-2xl bg-[#ea7c50]/15 border border-[#ea7c50]/30 flex items-center justify-center text-[#ea7c50] mb-6">
        <Printer className="w-6 h-6" />
      </div>
      <span className="font-mono text-xs uppercase tracking-widest text-[#ea7c50] mb-2">404 Error</span>
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mb-3">Page Not Found</h1>
      <p className="text-sm sm:text-base text-neutral-200 max-w-md mb-8">
        The counter terminal or document portal you are looking for does not exist or has expired.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white text-xs font-bold transition-all shadow-lg shadow-[#ea7c50]/20"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Return to Counter</span>
      </Link>
    </div>
  );
}
