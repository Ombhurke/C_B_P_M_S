'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { PaymentSuccessResponse } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  Printer,
  Copy,
  Check,
  Store,
  FileText,
  RotateCcw,
  CreditCard,
  Banknote,
} from 'lucide-react';

interface ReleaseTokenCardProps {
  data: PaymentSuccessResponse;
  fileName: string;
  shopName?: string;
  onReset?: () => void;
}

export default function ReleaseTokenCard({
  data,
  fileName,
  shopName,
  onReset,
}: ReleaseTokenCardProps) {
  const { session } = useCustomerAuth();
  const [timeLeft, setTimeLeft] = useState<string>('01:59:59');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const expiry = new Date(data.expires_at).getTime();
    const updateCountdown = () => {
      const now = new Date().getTime();
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeLeft('Expired');
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
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [data.expires_at]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.release_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const isCounter = data.payment_method === 'counter';

  return (
    <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-9 shadow-sm max-w-xl mx-auto text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Status Pill */}
      {isCounter ? (
        <div className="inline-flex items-center gap-2 bg-[#fdf3ea] border border-[#f5d0b5] text-[#8c4320] px-4 py-2 rounded-full text-xs font-bold">
          <Banknote className="w-4 h-4 text-[#c05634]" />
          <span>Pay at Counter · Release PIN Issued</span>
        </div>
      ) : (
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2 rounded-full text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Online Payment Verified · Print Queued</span>
        </div>
      )}

      {/* Main Instruction */}
      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#241814]">
          {isCounter ? 'Pay & Collect at Counter' : 'Ready for Print Release'}
        </h2>
        <p className="text-sm text-[#66554b] max-w-md mx-auto leading-relaxed">
          {isCounter ? (
            <>
              Show this PIN to the operator and pay{' '}
              <strong className="text-[#241814]">₹{data.total_cost.toFixed(2)}</strong> via cash
              or shop UPI upon collection.
            </>
          ) : (
            <>
              Your payment of{' '}
              <strong className="text-[#241814]">₹{data.total_cost.toFixed(2)}</strong> is confirmed.
              Show this 4-digit PIN or scan the barcode at the desk.
            </>
          )}
        </p>
      </div>

      {/* 4-Digit Release Code Banner */}
      <div className="bg-[#faf6f0] border-2 border-[#e6dfd5] rounded-3xl p-6 relative">
        <div className="text-[11px] uppercase tracking-widest text-[#8c7b70] font-bold mb-2">
          Counter Release PIN
        </div>
        <div className="flex items-center justify-center gap-3">
          <span className="text-5xl sm:text-6xl font-black tracking-widest text-[#241814] font-mono selection:bg-none">
            {data.release_token}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            title="Copy release PIN"
            className="p-2.5 rounded-xl border border-[#dcd4c8] hover:bg-white text-[#66554b] hover:text-[#241814] transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-emerald-700 font-semibold mt-2">Copied to clipboard!</p>
        )}
      </div>

      {/* Barcode / QR Section */}
      <div className="bg-[#faf6f0] p-5 rounded-3xl inline-block border border-[#e6dfd5] shadow-xs">
        <QRCodeSVG
          value={data.barcode_payload}
          size={180}
          level="H"
          fgColor="#241814"
          bgColor="#faf6f0"
          includeMargin={false}
        />
        <p className="text-[11px] text-[#8c7b70] font-mono font-medium mt-3 truncate max-w-[200px]">
          {data.job_id}
        </p>
      </div>

      {/* Job Details Card */}
      <div className="bg-[#faf6f0] border border-[#e6dfd5] rounded-2xl p-4 text-xs text-left space-y-2.5">
        <div className="flex items-center justify-between text-[#66554b]">
          <span className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-[#8c7b70]" />
            Document:
          </span>
          <span className="font-bold text-[#241814] truncate max-w-[220px]">{fileName}</span>
        </div>

        {shopName && (
          <div className="flex items-center justify-between text-[#66554b]">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-[#8c7b70]" />
              Print Shop:
            </span>
            <span className="font-semibold text-[#241814]">{shopName}</span>
          </div>
        )}

        <div className="flex items-center justify-between text-[#66554b]">
          <span className="flex items-center gap-1.5">
            {isCounter ? (
              <Banknote className="w-3.5 h-3.5 text-[#8c7b70]" />
            ) : (
              <CreditCard className="w-3.5 h-3.5 text-[#8c7b70]" />
            )}
            Payment:
          </span>
          <span className="font-semibold text-[#241814]">
            {isCounter ? 'Pay at Counter (Pending)' : 'Online (Razorpay Verified)'}
          </span>
        </div>

        <div className="flex items-center justify-between text-[#66554b] pt-1 border-t border-[#e6dfd5]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#8c7b70]" />
            Expires in:
          </span>
          <span className="font-mono font-bold text-[#c05634]">{timeLeft}</span>
        </div>
      </div>

      {/* Secure Auto-Shredding Notice */}
      <div className="p-3.5 rounded-2xl bg-[#f7f4ee] border border-[#e6dfd5] flex items-center justify-center gap-2 text-xs text-[#66554b]">
        <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
        <span>Document is automatically purged from the server once released.</span>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="w-full sm:flex-1 py-3.5 px-5 min-h-[48px] rounded-xl border border-[#dcd4c8] hover:bg-[#faf6f0] text-[#241814] text-sm font-semibold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Print another document</span>
          </button>
        )}

        <Link
          href={session ? '/account/documents' : '/shops'}
          className="w-full sm:flex-1 py-3.5 px-5 min-h-[48px] rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold transition-all shadow-md shadow-[#c05634]/20 flex items-center justify-center gap-2 text-center"
        >
          <Printer className="w-4 h-4" />
          <span>{session ? 'View my print jobs' : 'Browse other shops'}</span>
        </Link>
      </div>
    </div>
  );
}
