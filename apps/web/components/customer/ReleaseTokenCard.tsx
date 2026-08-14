'use client';

import React, { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { PaymentSuccessResponse } from '@/lib/types';
import { CheckCircle2, Clock, ShieldAlert, Sparkles, Printer, RefreshCw } from 'lucide-react';

interface ReleaseTokenCardProps {
  data: PaymentSuccessResponse;
  fileName: string;
}

export default function ReleaseTokenCard({ data, fileName }: ReleaseTokenCardProps) {
  const [timeLeft, setTimeLeft] = useState<string>('01:59:59');

  useEffect(() => {
    const expiry = new Date(data.expires_at).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft('00:00:00 (Expired)');
        clearInterval(interval);
      } else {
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / (1000 * 60)) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft(
          `${hours.toString().padStart(2, '0')}:${minutes
            .toString()
            .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [data.expires_at]);

  return (
    <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 text-center max-w-lg mx-auto shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
        <CheckCircle2 className="w-4 h-4" />
        <span>Payment Verified • Ready for Counter Release</span>
      </div>

      <h2 className="text-2xl font-black text-white tracking-tight">
        Show at Counter or Scan Barcode
      </h2>
      <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
        Operator will scan this 2D barcode with their USB reader or enter the 4-digit code.
      </p>

      {/* Big 4-Digit Release Code */}
      <div className="my-6 bg-slate-900/90 border border-sky-500/40 rounded-3xl p-5 relative overflow-hidden shadow-inner">
        <div className="text-[11px] uppercase tracking-widest text-sky-400 font-bold mb-1">
          4-Digit Counter PIN
        </div>
        <div className="text-5xl sm:text-6xl font-black tracking-widest text-white font-mono selection:bg-none">
          {data.release_token}
        </div>
      </div>

      {/* 2D Barcode / QR Section */}
      <div className="bg-white p-5 rounded-3xl inline-block shadow-2xl">
        <QRCodeSVG
          value={data.barcode_payload}
          size={200}
          level="H"
          includeMargin={false}
        />
        <div className="text-[10px] text-slate-700 font-mono font-bold mt-2 truncate max-w-[200px]">
          {data.job_id}
        </div>
      </div>

      {/* Job Details & Expiry */}
      <div className="mt-6 space-y-3 bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs text-left">
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-500">Document:</span>
          <span className="font-semibold truncate max-w-[200px]">{fileName}</span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-500">Status:</span>
          <span className="text-sky-400 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
            In Counter Queue
          </span>
        </div>
        <div className="flex justify-between text-slate-300">
          <span className="text-slate-500">Job Expiry TTL:</span>
          <span className="font-mono text-amber-400 font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Shredding Security Notice */}
      <div className="mt-5 p-3 rounded-xl bg-slate-900/40 border border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400">
        <ShieldAlert className="w-4 h-4 text-indigo-400 flex-shrink-0" />
        <span>Document is physically shredded from memory & cloud instantly post-print.</span>
      </div>
    </div>
  );
}
