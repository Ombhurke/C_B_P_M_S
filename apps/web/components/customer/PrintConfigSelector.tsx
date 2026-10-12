'use client';

import React from 'react';
import { PrintConfig, DuplexMode, PaperRateConfig } from '@/lib/types';
import { Palette, Copy, Layers, LayoutGrid, Scroll, FileCheck } from 'lucide-react';

interface PrintConfigSelectorProps {
  config: PrintConfig;
  onChange: (updated: Partial<PrintConfig>) => void;
  isBwSupported?: boolean;
  isColorSupported?: boolean;
  isDuplexSupported?: boolean;
  supportedLayouts?: number[];
  paperRates?: PaperRateConfig;
}

export default function PrintConfigSelector({
  config,
  onChange,
  isBwSupported = true,
  isColorSupported = true,
  isDuplexSupported = true,
  supportedLayouts = [1, 2, 4, 8],
  paperRates,
}: PrintConfigSelectorProps) {
  const currentPaper = config.paperType || 'normal';
  const normalRates = paperRates?.normal || { bw_single: 2, bw_duplex: 3, color_single: 10, color_duplex: 18 };
  const bondRates = paperRates?.bond || { bw_single: 3, bw_duplex: 5, color_single: 12, color_duplex: 22 };
  const activeRates = currentPaper === 'bond' ? bondRates : normalRates;

  const availableLayouts = [1, 2, 4, 8].filter((n) => supportedLayouts.includes(n));

  return (
    <div className="space-y-6 text-left">
      {/* 1. Print Scope (All Pages) */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-[#e6dfd5] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#fdf3ea] border border-[#f5d0b5] flex items-center justify-center text-[#c05634] flex-shrink-0">
            <FileCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c7b70]">Print scope</span>
            <p className="text-sm sm:text-base font-bold text-[#241814]">
              All pages ({config.pageCount} {config.pageCount === 1 ? 'page' : 'pages'})
            </p>
          </div>
        </div>
        <span className="text-xs text-[#66554b] bg-[#faf6f0] px-3 py-1.5 rounded-full border border-[#e6dfd5] font-semibold hidden sm:inline-block">
          Entire document
        </span>
      </div>

      {/* 2. Color Selection */}
      <div className="bg-white p-6 rounded-3xl border border-[#e6dfd5] shadow-xs space-y-4">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
          <Palette className="w-4 h-4 text-[#c05634]" />
          <span>Colour mode</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!isBwSupported}
            onClick={() => onChange({ isColor: false })}
            className={`p-4 min-h-[52px] rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
              !config.isColor
                ? 'border-[#c05634] bg-[#fdf3ea]'
                : !isBwSupported
                ? 'opacity-40 cursor-not-allowed border-[#e6dfd5] bg-neutral-100'
                : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
            }`}
          >
            <div>
              <span className="text-base font-bold text-[#241814]">Black &amp; white</span>
              <p className="text-xs text-[#66554b] mt-0.5">
                ₹{activeRates.bw_single}/page (single) · ₹{activeRates.bw_duplex} (double)
              </p>
            </div>
            {!config.isColor && <FileCheck className="w-5 h-5 text-[#c05634] flex-shrink-0" />}
          </button>

          <button
            type="button"
            disabled={!isColorSupported}
            onClick={() => onChange({ isColor: true })}
            className={`p-4 min-h-[52px] rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
              config.isColor
                ? 'border-[#c05634] bg-[#fdf3ea]'
                : !isColorSupported
                ? 'opacity-40 cursor-not-allowed border-[#e6dfd5] bg-neutral-100'
                : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold text-[#241814]">Colour</span>
                {!isColorSupported && (
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-neutral-200 text-neutral-600">
                    Not supported
                  </span>
                )}
              </div>
              <p className="text-xs text-[#66554b] mt-0.5">
                ₹{activeRates.color_single}/page (single) · ₹{activeRates.color_duplex} (double)
              </p>
            </div>
            {config.isColor && <FileCheck className="w-5 h-5 text-[#c05634] flex-shrink-0" />}
          </button>
        </div>
      </div>

      {/* 3. Sides / Duplex Mode */}
      <div className="bg-white p-6 rounded-3xl border border-[#e6dfd5] shadow-xs space-y-4">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
          <Layers className="w-4 h-4 text-[#c05634]" />
          <span>Sides</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { id: 'simplex' as DuplexMode, label: 'Single-sided', desc: '1 side per sheet' },
            { id: 'duplex_long' as DuplexMode, label: 'Double-sided (Long)', desc: 'Flip long edge' },
            { id: 'duplex_short' as DuplexMode, label: 'Double-sided (Short)', desc: 'Flip short edge' },
          ].map((mode) => {
            const isSupported = mode.id === 'simplex' || isDuplexSupported;
            return (
              <button
                key={mode.id}
                type="button"
                disabled={!isSupported}
                onClick={() => onChange({ duplexMode: mode.id })}
                className={`p-3.5 min-h-[52px] rounded-2xl border-2 text-left flex flex-col justify-between transition-all cursor-pointer ${
                  config.duplexMode === mode.id
                    ? 'border-[#c05634] bg-[#fdf3ea]'
                    : !isSupported
                    ? 'opacity-40 cursor-not-allowed border-[#e6dfd5] bg-neutral-100'
                    : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[#241814]">{mode.label}</span>
                  {config.duplexMode === mode.id && <FileCheck className="w-4 h-4 text-[#c05634]" />}
                </div>
                <span className="text-xs text-[#66554b] mt-1">
                  {!isSupported ? 'Not supported at this shop' : mode.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. Copies & Pages per sheet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Copies Counter */}
        <div className="bg-white p-6 rounded-3xl border border-[#e6dfd5] shadow-xs space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
            <Copy className="w-4 h-4 text-[#c05634]" />
            <span>Copies</span>
          </label>
          <div className="flex items-center justify-between bg-[#faf6f0] border border-[#e6dfd5] rounded-2xl p-2 min-h-[52px]">
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.max(1, config.copyCount - 1) })}
              className="w-11 h-11 rounded-xl bg-white hover:bg-neutral-100 text-[#241814] border border-[#dcd4c8] font-bold text-lg flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Decrease copies"
            >
              -
            </button>
            <span className="text-xl font-bold font-mono text-[#241814] px-4">{config.copyCount}</span>
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.min(50, config.copyCount + 1) })}
              className="w-11 h-11 rounded-xl bg-white hover:bg-neutral-100 text-[#241814] border border-[#dcd4c8] font-bold text-lg flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Increase copies"
            >
              +
            </button>
          </div>
        </div>

        {/* N-Up Pages Per Sheet */}
        <div className="bg-white p-6 rounded-3xl border border-[#e6dfd5] shadow-xs space-y-3">
          <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
            <LayoutGrid className="w-4 h-4 text-[#c05634]" />
            <span>Pages per sheet</span>
          </label>
          <div className="grid grid-cols-4 gap-2">
            {availableLayouts.map((nup) => (
              <button
                key={nup}
                type="button"
                onClick={() => onChange({ layoutNup: nup })}
                className={`min-h-[52px] rounded-xl border-2 text-center font-bold text-sm transition-all cursor-pointer ${
                  config.layoutNup === nup
                    ? 'border-[#c05634] bg-[#fdf3ea] text-[#c05634]'
                    : 'border-[#e6dfd5] bg-[#faf6f0] text-[#241814] hover:border-[#c05634]/40'
                }`}
              >
                {nup}-up
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 5. Paper Stock Selection */}
      <div className="bg-white p-6 rounded-3xl border border-[#e6dfd5] shadow-xs space-y-4">
        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
          <Scroll className="w-4 h-4 text-[#c05634]" />
          <span>Paper stock</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ paperType: 'normal' })}
            className={`p-4 min-h-[52px] rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
              currentPaper === 'normal'
                ? 'border-[#c05634] bg-[#fdf3ea]'
                : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
            }`}
          >
            <div>
              <span className="text-base font-bold text-[#241814]">A4 · Standard (75 GSM)</span>
              <p className="text-xs text-[#66554b] mt-0.5">Clean everyday paper for assignments &amp; notes</p>
            </div>
            {currentPaper === 'normal' && <FileCheck className="w-5 h-5 text-[#c05634] flex-shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => onChange({ paperType: 'bond' })}
            className={`p-4 min-h-[52px] rounded-2xl border-2 text-left flex items-center justify-between transition-all cursor-pointer ${
              currentPaper === 'bond'
                ? 'border-[#c05634] bg-[#fdf3ea]'
                : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
            }`}
          >
            <div>
              <span className="text-base font-bold text-[#241814]">A4 · Bond (Executive/Thesis)</span>
              <p className="text-xs text-[#66554b] mt-0.5">Heavy premium paper for resumes &amp; reports</p>
            </div>
            {currentPaper === 'bond' && <FileCheck className="w-5 h-5 text-[#c05634] flex-shrink-0" />}
          </button>
        </div>
      </div>
    </div>
  );
}
