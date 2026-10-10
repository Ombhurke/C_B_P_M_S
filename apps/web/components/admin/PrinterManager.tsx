'use client';

import React from 'react';
import { Printer } from '@/lib/types';
import { Printer as PrinterIcon, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';

interface PrinterManagerProps {
  printers: Printer[];
}

export default function PrinterManager({ printers }: PrinterManagerProps) {
  return (
    <div className="glass-panel p-6 rounded-3xl border border-[#f5efe6]/10">
      <div className="flex items-center justify-between pb-3 border-b border-[#f5efe6]/10 mb-4">
        <div className="flex items-center gap-2 text-[#fbf9f5] font-bold text-base">
          <PrinterIcon className="w-5 h-5 text-[#ea7c50]" />
          <span>Registered Counter Printers</span>
        </div>
        <span className="text-xs text-[#ba9e88]">{printers.length} registered devices · saved configuration</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="bg-[#14100e]/70 border border-[#f5efe6]/10 p-4 rounded-2xl flex items-start justify-between"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ea7c50]/15 border border-[#ea7c50]/30 flex items-center justify-center text-[#ea7c50] flex-shrink-0">
                <PrinterIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-semibold text-[#fbf9f5] text-sm">{printer.device_name}</h4>
                <div className="flex items-center gap-2 text-[11px] text-[#ba9e88] mt-1">
                  <span className="bg-[#231a14] px-2 py-0.5 rounded font-mono text-[#d5cdc4]">Max: {printer.max_paper_size}</span>
                  <span>•</span>
                  <span>{printer.is_color_supported ? 'Color' : 'B&W'}</span>
                  <span>•</span>
                  <span>{printer.is_duplex_supported ? 'Duplex' : 'Simplex'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold text-[#34d399] bg-[#34d399]/10 border border-[#34d399]/20 px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
              <span>{printer.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
