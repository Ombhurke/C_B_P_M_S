'use client';

import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { QrCode, CreditCard, Smartphone, CheckCircle, Lock, X } from 'lucide-react';

interface PaymentModalProps {
  isOpen: boolean;
  totalCost: number;
  currency: string;
  onConfirm: (paymentId: string) => void;
  onClose: () => void;
}

export default function PaymentModal({
  isOpen,
  totalCost,
  currency,
  onConfirm,
  onClose
}: PaymentModalProps) {
  const [method, setMethod] = useState<'upi' | 'card'>('upi');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleSimulatedPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      const mockPayId = `pay_${Math.random().toString(36).substring(2, 12)}`;
      onConfirm(mockPayId);
    }, 1200);
  };

  const upiIntentString = `upi://pay?pa=cbpms.merchant@okaxis&pn=CBPMS_PrintShop&am=${totalCost}&cu=${currency}&tn=PrintJobPrePayment`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-700 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-5">
          <div className="inline-flex p-3 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-2">
            <Lock className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-white">Upfront Payment Firewall</h3>
          <p className="text-xs text-slate-400 mt-1">
            Zero-PII instant checkout. File enters queue upon payment verification.
          </p>
        </div>

        {/* Amount Header */}
        <div className="bg-slate-900/80 rounded-2xl p-4 text-center border border-slate-800 mb-5">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount Due</div>
          <div className="text-3xl font-extrabold text-white mt-1">
            {currency} {totalCost.toFixed(2)}
          </div>
        </div>

        {/* UPI QR Display */}
        <div className="flex flex-col items-center justify-center bg-white p-6 rounded-2xl mb-5 shadow-inner">
          <QRCodeSVG value={upiIntentString} size={180} level="M" />
          <div className="flex items-center gap-2 text-slate-800 text-xs font-semibold mt-3">
            <Smartphone className="w-4 h-4 text-indigo-600" />
            <span>Scan with any UPI App (GPay, PhonePe, Paytm)</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          disabled={isProcessing}
          onClick={handleSimulatedPayment}
          className="w-full py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Simulate Verified Payment (₹{totalCost.toFixed(2)})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
