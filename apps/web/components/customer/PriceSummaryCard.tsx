'use client';

import React from 'react';
import { CostCalculation } from '@/lib/types';
import { IndianRupee, Zap, ShieldCheck } from 'lucide-react';

interface PriceSummaryCardProps {
  calculation: CostCalculation | null;
  onProceedToPayment: () => void;
  isLoading?: boolean;
  disabled?: boolean;
}

export default function PriceSummaryCard({
  calculation,
  onProceedToPayment,
  isLoading = false,
  disabled = false
}: PriceSummaryCardProps) {
  if (!calculation) return null;

  return (
    <div className="glass-panel-glow rounded-3xl p-6 relative overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between pb-4 border-b border-[#f5efe6]/10">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-[#ea7c50]">
            Estimated cost · verified at checkout
          </span>
          <div className="text-xs text-[#ba9e88] mt-0.5">
            {calculation.page_count} Pages × {calculation.copy_count} Copies ({calculation.total_sheets} Sheets)
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold text-[#fbf9f5] tracking-tight flex items-center justify-end">
            <span className="text-sm font-medium text-[#ba9e88] mr-1">{calculation.currency}</span>
            {calculation.total_cost.toFixed(2)}
          </div>
        </div>
      </div>

      <div className="py-3 space-y-2 text-xs">
        <div className="flex justify-between text-[#ba9e88]">
          <span>Paper Stock:</span>
          <span className="font-semibold text-[#fbf9f5]">
            {calculation.paper_type === 'bond' ? 'Bond Paper (Executive)' : 'Standard (70–75 GSM)'}
          </span>
        </div>

        {calculation.layout_nup > 1 && (
          <div className="flex justify-between text-[#ba9e88]">
            <span>Layout Arrangement:</span>
            <span className="font-mono text-[#fbf9f5]">{calculation.layout_nup}-Up (No extra fee)</span>
          </div>
        )}

        <div className="flex justify-between text-[#ba9e88]">
          <span>Rate per Page ({calculation.is_color ? 'Color' : 'B&W'}):</span>
          <span className="font-mono text-[#fbf9f5]">{calculation.currency} {calculation.rate_per_page.toFixed(2)}</span>
        </div>
        
        {calculation.discount > 0 && (
          <div className="flex justify-between text-[#34d399] font-medium">
            <span>Duplex Paper Saver Discount:</span>
            <span className="font-mono">- {calculation.currency} {calculation.discount.toFixed(2)}</span>
          </div>
        )}

        <div className="flex justify-between text-[#ba9e88]">
          <span>Cloud Transit & Auto-Shred Service:</span>
          <span className="text-[#34d399] font-medium font-mono">FREE (₹0.00)</span>
        </div>
      </div>

      <button
        type="button"
        disabled={disabled || isLoading}
        onClick={onProceedToPayment}
        className="w-full mt-4 py-4 px-6 rounded-2xl bg-gradient-to-r from-[#ea7c50] to-[#d75d31] hover:from-[#f39d78] hover:to-[#ea7c50] text-white font-bold text-base shadow-lg shadow-[#ea7c50]/25 flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {isLoading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Zap className="w-5 h-5 fill-current" />
            <span>Upload & review checkout</span>
          </>
        )}
      </button>

      <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-[#ba9e88]">
        <ShieldCheck className="w-4 h-4 text-[#34d399] flex-shrink-0" />
        <span>No real payment · Final amount uses verified document pages</span>
      </div>
    </div>
  );
}
