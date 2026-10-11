'use client';

import React from 'react';
import Link from 'next/link';
import { Shop } from '@/lib/types';
import { ArrowLeft, MapPin, Printer, Shield, CheckCircle2, Scroll, Layers } from 'lucide-react';

interface ShopBannerProps {
  shop: Shop | null;
}

export default function ShopBanner({ shop }: ShopBannerProps) {
  const normalRates = shop?.paper_rates?.normal || { bw_single: 2, bw_duplex: 3, color_single: 10, color_duplex: 18 };
  const bondRates = shop?.paper_rates?.bond || { bw_single: 3, bw_duplex: 5, color_single: 12, color_duplex: 22 };

  return (
    <div className="w-full space-y-4 mb-8">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex items-center justify-between">
        <Link
          href="/shops"
          className="inline-flex items-center gap-2 text-xs sm:text-sm text-neutral-300 hover:text-white transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 text-[#ea7c50] group-hover:-translate-x-1 transition-transform" />
          <span>Return to All Counter Stations</span>
        </Link>
        <div className="flex items-center gap-2 text-xs bg-[#231a14]/80 border border-white/10 text-[#ea7c50] px-3.5 py-1.5 rounded-full font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-300">
            {shop?.printers?.some(p => p.status === 'online') ? 'Counter station ready' : 'Station active'}
          </span>
        </div>
      </div>

      {/* Main Shop Details Banner */}
      {shop && (
        <div className="glass-panel p-6 lg:p-8 rounded-3xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#ea7c50]">
              <Printer className="w-4 h-4" />
              <span>Counter Walk-In Station</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-extrabold text-[#fbf9f5] tracking-tight">
              {shop.name}
            </h1>
            <div className="flex items-center gap-4 text-xs sm:text-sm text-neutral-300 flex-wrap">
              {shop.address && (
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#ea7c50]" />
                  {shop.address}
                </span>
              )}
              <span className="text-white/20">•</span>
              <span className="flex items-center gap-1.5 text-neutral-300">
                <Shield className="w-4 h-4 text-[#34d399]" />
                Zero-install walk-in upload
              </span>
            </div>

            {/* Capabilities Chips */}
            <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px] text-[#ba9e88]">
              <span className="px-2.5 py-1 rounded-lg bg-[#231a14] border border-white/10 flex items-center gap-1.5">
                <Scroll className="w-3.5 h-3.5 text-[#ea7c50]" />
                Standard & Bond Paper
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#231a14] border border-white/10 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#ea7c50]" />
                Duplex (2-Sided)
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-[#231a14] border border-white/10 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
                1, 2, 4, 8-Up Layouts (No Fee)
              </span>
            </div>
          </div>

          {/* Rates Pill Box */}
          <div className="flex items-center gap-3 bg-[#191310] border border-white/10 p-3 sm:p-4 rounded-2xl shrink-0">
            <div className="px-3 py-1 border-r border-white/10 text-center">
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Standard B&W</div>
              <div className="text-sm sm:text-base font-mono font-bold text-[#fbf9f5]">
                ₹{normalRates.bw_single}<span className="text-[10px] text-neutral-400 font-normal"> (₹{normalRates.bw_duplex} duplex)</span>
              </div>
            </div>
            <div className="px-3 py-1 border-r border-white/10 text-center">
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Bond B&W</div>
              <div className="text-sm sm:text-base font-mono font-bold text-[#f3a261]">
                ₹{bondRates.bw_single}<span className="text-[10px] text-neutral-400 font-normal"> (₹{bondRates.bw_duplex} duplex)</span>
              </div>
            </div>
            <div className="px-3 py-1 text-center">
              <div className="text-[10px] text-neutral-400 uppercase font-bold tracking-wider">Color</div>
              <div className="text-sm sm:text-base font-mono font-bold text-[#ea7c50]">
                ₹{normalRates.color_single}<span className="text-[10px] text-neutral-400 font-normal">/pg</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
