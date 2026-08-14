'use client';

import React from 'react';
import { PrintConfig, DuplexMode } from '@/lib/types';
import { Palette, Copy, Layers, LayoutGrid, FileCheck } from 'lucide-react';

interface PrintConfigSelectorProps {
  config: PrintConfig;
  onChange: (updated: Partial<PrintConfig>) => void;
  isColorSupported?: boolean;
  isDuplexSupported?: boolean;
}

export default function PrintConfigSelector({
  config,
  onChange,
  isColorSupported = true,
  isDuplexSupported = true
}: PrintConfigSelectorProps) {
  return (
    <div className="space-y-6">
      {/* 1. Color Mode */}
      <div className="glass-panel p-5 rounded-2xl">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          <Palette className="w-4 h-4 text-sky-400" />
          Color Output Mode
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => onChange({ isColor: false })}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              !config.isColor
                ? 'border-sky-500 bg-sky-500/15 ring-1 ring-sky-500/50'
                : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${!config.isColor ? 'text-white' : 'text-slate-300'}`}>
                Monochrome (B&W)
              </span>
              {!config.isColor && <FileCheck className="w-4 h-4 text-sky-400" />}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">High-speed economy black & white</span>
          </button>

          <button
            type="button"
            disabled={!isColorSupported}
            onClick={() => onChange({ isColor: true })}
            className={`p-3.5 rounded-xl border text-left flex flex-col justify-between transition-all ${
              config.isColor
                ? 'border-indigo-500 bg-indigo-500/15 ring-1 ring-indigo-500/50'
                : !isColorSupported
                ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-900/40 text-slate-500'
                : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-sm font-semibold ${config.isColor ? 'text-white' : 'text-slate-300'}`}>
                Full Color
              </span>
              {config.isColor && <FileCheck className="w-4 h-4 text-indigo-400" />}
            </div>
            <span className="text-[11px] text-slate-400 mt-1">Vibrant photo & graphics quality</span>
          </button>
        </div>
      </div>

      {/* 2. Duplex Mode (Sides) */}
      <div className="glass-panel p-5 rounded-2xl">
        <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          <Layers className="w-4 h-4 text-sky-400" />
          Two-Sided (Duplex) Printing
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'simplex' as DuplexMode, label: 'Single-Sided', desc: '1 page per sheet' },
            { id: 'duplex_long' as DuplexMode, label: 'Double (Long)', desc: 'Flip long edge' },
            { id: 'duplex_short' as DuplexMode, label: 'Double (Short)', desc: 'Flip short edge' }
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={mode.id !== 'simplex' && !isDuplexSupported}
              onClick={() => onChange({ duplexMode: mode.id })}
              className={`p-3 rounded-xl border text-center transition-all ${
                config.duplexMode === mode.id
                  ? 'border-sky-500 bg-sky-500/15 text-white ring-1 ring-sky-500/50'
                  : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-900 hover:text-slate-200'
              }`}
            >
              <div className="text-xs font-semibold">{mode.label}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{mode.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Copies & N-up Layout Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Copies Counter */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <Copy className="w-4 h-4 text-sky-400" />
            Number of Copies
          </label>
          <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 mt-2">
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.max(1, config.copyCount - 1) })}
              className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors"
            >
              -
            </button>
            <span className="text-lg font-bold text-white px-4 font-mono">{config.copyCount}</span>
            <button
              type="button"
              onClick={() => onChange({ copyCount: Math.min(50, config.copyCount + 1) })}
              className="w-10 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center justify-center transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {/* N-Up Pages Per Sheet */}
        <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between">
          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            <LayoutGrid className="w-4 h-4 text-sky-400" />
            Pages Per Sheet (N-Up)
          </label>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {[1, 2, 4].map((nup) => (
              <button
                key={nup}
                type="button"
                onClick={() => onChange({ layoutNup: nup })}
                className={`py-2.5 rounded-xl border text-center font-mono text-xs font-bold transition-all ${
                  config.layoutNup === nup
                    ? 'border-sky-500 bg-sky-500/15 text-white ring-1 ring-sky-500/50'
                    : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-900'
                }`}
              >
                {nup}-Up
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
