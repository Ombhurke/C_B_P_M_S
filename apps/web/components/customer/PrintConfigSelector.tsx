'use client';

import React from 'react';
import { PrintConfig, DuplexMode, PaperRateConfig } from '@/lib/types';
import { Palette, Copy, Layers, LayoutGrid, FileCheck, Scroll, Info } from 'lucide-react';

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
  paperRates
}: PrintConfigSelectorProps) {
  const currentPaper = config.paperType || 'normal';
  const normalRates = paperRates?.normal || { bw_single: 2, bw_duplex: 3, color_single: 10, color_duplex: 18 };
  const bondRates = paperRates?.bond || { bw_single: 3, bw_duplex: 5, color_single: 12, color_duplex: 22 };
  const activeRates = currentPaper === 'bond' ? bondRates : normalRates;

  const availableLayouts = [1, 2, 4, 8].filter(n => supportedLayouts.includes(n));

  return (
    <div className="space-y-6">
      {/* 1. Paper Stock Selection */}
      <div className="glass-panel p-5 rounded-3xl">
        <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-[#ba9e88] mb-3">
          <span className="flex items-center gap-2">
            <Scroll className="w-4 h-4 text-[#ea7c50]" />
            Paper Stock & Weight
          </span>
          <span className="text-[11px] font-mono text-[#ea7c50] normal-case">Physical media</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ paperType: 'normal' })}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              currentPaper === 'normal'
                ? 'border-[#ea7c50] bg-[#ea7c50]/15 ring-1 ring-[#ea7c50]/50'
                : 'border-[#f5efe6]/10 bg-[#231a14]/60 hover:bg-[#231a14]/90 text-[#ba9e88]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${currentPaper === 'normal' ? 'text-[#fbf9f5]' : 'text-[#d5cdc4]'}`}>
                Standard Paper (70–75 GSM)
              </span>
              {currentPaper === 'normal' && <FileCheck className="w-4 h-4 text-[#ea7c50]" />}
            </div>
            <p className="text-[11px] text-[#ba9e88] mt-1.5">Clean everyday paper for notes & assignments</p>
            <div className="mt-2 text-[11px] font-mono font-bold text-[#ea7c50]">
              ₹{normalRates.bw_single}/pg B&W · ₹{normalRates.bw_duplex} Both sides
            </div>
          </button>

          <button
            type="button"
            onClick={() => onChange({ paperType: 'bond' })}
            className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              currentPaper === 'bond'
                ? 'border-[#f3a261] bg-[#f3a261]/15 ring-1 ring-[#f3a261]/50'
                : 'border-[#f5efe6]/10 bg-[#231a14]/60 hover:bg-[#231a14]/90 text-[#ba9e88]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${currentPaper === 'bond' ? 'text-[#fbf9f5]' : 'text-[#d5cdc4]'}`}>
                Bond Paper (Executive/Thesis)
              </span>
              {currentPaper === 'bond' && <FileCheck className="w-4 h-4 text-[#f3a261]" />}
            </div>
            <p className="text-[11px] text-[#ba9e88] mt-1.5">Heavy premium stock for resumes, thesis & certificates</p>
            <div className="mt-2 text-[11px] font-mono font-bold text-[#f3a261]">
              ₹{bondRates.bw_single}/pg B&W · ₹{bondRates.bw_duplex} Both sides
            </div>
          </button>
        </div>
      </div>

      {/* 2. Color Output Mode */}
      <div className="glass-panel p-5 rounded-3xl">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ba9e88] mb-3">
          <Palette className="w-4 h-4 text-[#ea7c50]" />
          Color Output Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={!isBwSupported}
            onClick={() => onChange({ isColor: false })}
            className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              !config.isColor
                ? 'border-[#ea7c50] bg-[#ea7c50]/15 ring-1 ring-[#ea7c50]/50'
                : !isBwSupported
                ? 'opacity-40 cursor-not-allowed border-[#f5efe6]/5 bg-[#231a14]/30 text-[#8d7b68]'
                : 'border-[#f5efe6]/10 bg-[#231a14]/60 hover:bg-[#231a14]/90 text-[#ba9e88]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${!config.isColor ? 'text-[#fbf9f5]' : 'text-[#d5cdc4]'}`}>
                Monochrome (B&W)
              </span>
              {!config.isColor && <FileCheck className="w-4 h-4 text-[#ea7c50]" />}
            </div>
            <span className="text-[11px] text-[#ba9e88] mt-1">
              ₹{activeRates.bw_single}/pg (1 side) · ₹{activeRates.bw_duplex} (2 sides)
            </span>
          </button>

          <button
            type="button"
            disabled={!isColorSupported}
            onClick={() => onChange({ isColor: true })}
            className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
              config.isColor
                ? 'border-[#f3a261] bg-[#f3a261]/15 ring-1 ring-[#f3a261]/50'
                : !isColorSupported
                ? 'opacity-40 cursor-not-allowed border-[#f5efe6]/5 bg-[#231a14]/30 text-[#8d7b68]'
                : 'border-[#f5efe6]/10 bg-[#231a14]/60 hover:bg-[#231a14]/90 text-[#ba9e88]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${config.isColor ? 'text-[#fbf9f5]' : 'text-[#d5cdc4]'}`}>
                Full Color
              </span>
              {config.isColor && <FileCheck className="w-4 h-4 text-[#f3a261]" />}
            </div>
            <span className="text-[11px] text-[#ba9e88] mt-1">
              ₹{activeRates.color_single}/pg (1 side) · ₹{activeRates.color_duplex} (2 sides)
            </span>
          </button>
        </div>
      </div>

      {/* 3. Duplex Mode (Sides) */}
      <div className="glass-panel p-5 rounded-3xl">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ba9e88] mb-3">
          <Layers className="w-4 h-4 text-[#ea7c50]" />
          Two-Sided (Duplex) Printing
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'simplex' as DuplexMode, label: 'Single-Sided', desc: '1 side/sheet' },
            { id: 'duplex_long' as DuplexMode, label: 'Double (Long)', desc: 'Flip long edge' },
            { id: 'duplex_short' as DuplexMode, label: 'Double (Short)', desc: 'Flip short edge' }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={mode.id !== 'simplex' && !isDuplexSupported}
              onClick={() => onChange({ duplexMode: mode.id })}
              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                config.duplexMode === mode.id
                  ? 'border-[#ea7c50] bg-[#ea7c50]/15 text-[#fbf9f5] ring-1 ring-[#ea7c50]/50'
                  : mode.id !== 'simplex' && !isDuplexSupported
                  ? 'opacity-40 cursor-not-allowed border-[#f5efe6]/5 bg-[#231a14]/30 text-[#8d7b68]'
                  : 'border-[#f5efe6]/10 bg-[#231a14]/60 text-[#ba9e88] hover:bg-[#231a14] hover:text-[#fbf9f5]'
              }`}
            >
              <div className="text-xs font-semibold">{mode.label}</div>
              <div className="text-[10px] text-[#ba9e88] mt-0.5">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 4. Copies & N-Up Pages Per Sheet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Copies Counter */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ba9e88] mb-2">
            <Copy className="w-4 h-4 text-[#ea7c50]" />
            Number of Copies
          </label>
          <div className="flex items-center justify-between bg-[#231a14]/90 border border-[#f5efe6]/10 rounded-2xl p-1.5 mt-2">
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.max(1, config.copyCount - 1) })}
              className="w-10 h-10 rounded-xl bg-[#382b23] hover:bg-[#4d3b30] text-[#fbf9f5] font-bold flex items-center justify-center transition-colors cursor-pointer"
            >
              -
            </button>
            <span className="text-lg font-bold text-[#fbf9f5] px-4 font-mono">{config.copyCount}</span>
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.min(50, config.copyCount + 1) })}
              className="w-10 h-10 rounded-xl bg-[#382b23] hover:bg-[#4d3b30] text-[#fbf9f5] font-bold flex items-center justify-center transition-colors cursor-pointer"
            >
              +
            </button>
          </div>
        </div>

        {/* N-Up Pages Per Sheet */}
        <div className="glass-panel p-5 rounded-3xl flex flex-col justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#ba9e88] mb-2">
            <LayoutGrid className="w-4 h-4 text-[#ea7c50]" />
            Pages Per Sheet (N-Up)
          </label>
          <div className="grid grid-cols-4 gap-1.5 mt-2">
            {availableLayouts.map((nup) => (
              <button
                key={nup}
                type="button"
                onClick={() => onChange({ layoutNup: nup })}
                className={`py-2.5 rounded-2xl border text-center font-mono text-xs font-bold transition-all cursor-pointer ${
                  config.layoutNup === nup
                    ? 'border-[#ea7c50] bg-[#ea7c50]/15 text-[#fbf9f5] ring-1 ring-[#ea7c50]/50'
                    : 'border-[#f5efe6]/10 bg-[#231a14]/60 text-[#ba9e88] hover:bg-[#231a14] hover:text-[#fbf9f5]'
                }`}
              >
                {nup}-Up
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-[10px] text-[#ba9e88]">
            <Info className="w-3.5 h-3.5 text-[#ea7c50] shrink-0" />
            <span>Pages grouped onto sheets with no extra charge</span>
          </div>
        </div>
      </div>
    </div>
  );
}
