'use client';

import React from 'react';
import { Sparkles } from 'lucide-react';

interface HeroBadgeProps {
  label?: string;
}

export default function HeroBadge({ label = 'Private Walk-in & Desktop Cloud Printing Ecosystem' }: HeroBadgeProps) {
  return (
    <div className="inline-flex items-center gap-2 bg-[#ea7c50]/15 border border-[#ea7c50]/35 text-[#f9bfa3] px-4 py-1.5 rounded-full text-xs font-semibold mb-6 shadow-sm backdrop-blur-md animate-in fade-in duration-500 hover:border-[#ea7c50]/55 transition-colors">
      <Sparkles className="w-3.5 h-3.5 text-[#f39d78]" />
      <span className="tracking-wide">{label}</span>
    </div>
  );
}
