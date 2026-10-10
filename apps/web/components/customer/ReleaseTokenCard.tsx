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
      <div className="inline-flex items-center gap-2 bg-[#34d399]/15 border border-[#34d399]/30 text-[#34d399] px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
        <CheckCircle2 className="w-4 h-4" />
        <span>Mock payment confirmed · Release code issued</span>
      </div>

      <h2 className="text-2xl font-black text-[#fbf9f5] tracking-tight">
        Show at Counter or Scan Barcode
      </h2>
      <p className="text-xs text-[#ba9e88] mt-1 max-w-sm mx-auto">
        No money was charged. The operator can scan this code or enter the PIN in the desktop agent.
      </p>

      {/* Big 4-Digit Release Code */}
      <div className="my-6 bg-[#231a14]/90 border border-[#ea7c50]/40 rounded-3xl p-5 relative overflow-hidden shadow-inner">
        <div className="text-[11px] uppercase tracking-widest text-[#ea7c50] font-bold mb-1">
          4-Digit Counter PIN
        </div>
        <div className="text-5xl sm:text-6xl font-black tracking-widest text-[#fbf9f5] font-mono selection:bg-none">
          {data.release_token}
        </div>
      </div>

      {/* 2D Barcode / QR Section */}
      <div className="bg-[#faf7f2] p-5 rounded-3xl inline-block shadow-2xl border border-[#e7ded3]">
        <QRCodeSVG
          value={data.barcode_payload}
          size={200}
          level="H"
          fgColor="#231a14"
          bgColor="#faf7f2"
          includeMargin={false}
        />
        <div className="text-[10px] text-[#7d614c] font-mono font-bold mt-2 truncate max-w-[200px]">
          {data.job_id}
        </div>
      </div>

      {/* Job Details & Expiry */}
      <div className="mt-6 space-y-3 bg-[#231a14]/60 border border-[#f5efe6]/10 rounded-2xl p-4 text-xs text-left">
        <div className="flex justify-between text-[#d5cdc4]">
          <span className="text-[#8d7b68]">Document:</span>
          <span className="font-semibold truncate max-w-[200px] text-[#fbf9f5]">{fileName}</span>
        </div>
        <div className="flex justify-between text-[#d5cdc4]">
          <span className="text-[#8d7b68]">Status:</span>
          <span className="text-[#ea7c50] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#ea7c50] animate-ping" />
            Code issued · counter confirms print status
          </span>
        </div>
        <div className="flex justify-between text-[#d5cdc4]">
          <span className="text-[#8d7b68]">Job Expiry TTL:</span>
          <span className="font-mono text-[#f3a261] font-bold flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}
          </span>
        </div>
      </div>

      {/* Shredding Security Notice */}
      <div className="mt-5 p-3 rounded-2xl bg-[#231a14]/40 border border-[#f5efe6]/10 flex items-center justify-center gap-2 text-[11px] text-[#ba9e88]">
        <ShieldAlert className="w-4 h-4 text-[#f3a261] flex-shrink-0" />
        <span>File deletion is requested after the operator confirms successful spooling.</span>
      </div>
    </div>
  );
}
