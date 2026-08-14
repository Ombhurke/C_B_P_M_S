'use client';

import React from 'react';
import { Printer } from '@/lib/types';
import { Printer as PrinterIcon, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface PrinterManagerProps {
  printers: Printer[];
}

export default function PrinterManager({ printers }: PrinterManagerProps) {
  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <PrinterIcon className="w-5 h-5 text-indigo-400" />
          <span>Registered Counter Printers</span>
        </div>
        <span className="text-xs text-slate-400">{printers.length} devices online</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="bg-slate-900/80 border border-slate-800 p-4 rounded-2xl flex items-start justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400 flex-shrink-0">
                <PrinterIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-sm">{printer.device_name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                  <span className="bg-slate-800 px-2 py-0.5 rounded font-mono">Max: {printer.max_paper_size}</span>
                  <span>•</span>
                  <span>{printer.is_color_supported ? 'Color' : 'B&W'}</span>
                  <span>•</span>
                  <span>{printer.is_duplex_supported ? 'Duplex' : 'Simplex'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{printer.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
