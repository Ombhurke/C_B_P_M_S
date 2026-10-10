'use client';

import React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, AlertCircle, ChevronRight, Inbox, Info } from 'lucide-react';
import { CustomerJob } from '@/lib/types';

interface JobDetailPaneProps {
  job: CustomerJob | null;
}

export default function JobDetailPane({ job }: JobDetailPaneProps) {
  if (!job) {
    return (
      <div className="bg-[#ffffff] rounded-3xl p-10 border border-[#e6dfd5] text-center shadow-xs h-full flex flex-col items-center justify-center min-h-[460px] text-[#8c7b70]">
        <div className="w-16 h-16 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#d4c8bb] mb-3">
          <Inbox className="w-8 h-8" />
        </div>
        <p className="text-lg font-serif font-bold text-[#241814]">No print job selected</p>
        <p className="text-sm text-[#8c7b70] mt-1.5 max-w-xs leading-relaxed">
          Select any print request from your history list to review order specifications, transparent pricing, and counter pickup details.
        </p>
      </div>
    );
  }

  const isPending = job.payment_status === 'pending';
  const isCompleted = job.job_status === 'completed';
  const isQueued = job.job_status === 'queued';

  return (
    <div className="bg-[#ffffff] rounded-3xl p-8 sm:p-10 border border-[#e6dfd5] shadow-xs text-left space-y-6">
      {/* Title & Status Pill */}
      <div>
        <h3 className="text-2xl sm:text-3xl font-serif text-[#241814] font-bold tracking-tight break-all leading-snug">
          {job.file_name}
        </h3>

        <div className="mt-3">
          {isPending ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#faebe6] text-[#b85333] text-xs sm:text-sm font-semibold">
              <Clock className="w-4 h-4" />
              <span>Awaiting payment</span>
            </span>
          ) : isCompleted ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-800 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              <span>Completed</span>
            </span>
          ) : isQueued ? (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-50 text-amber-800 text-xs sm:text-sm font-semibold">
              <Clock className="w-4 h-4" />
              <span>Queued for printing</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-100 text-neutral-700 text-xs sm:text-sm font-semibold">
              <AlertCircle className="w-4 h-4" />
              <span className="capitalize">{job.job_status}</span>
            </span>
          )}
        </div>
      </div>

      {/* Print Summary Breakdown */}
      <div>
        <h4 className="text-base font-bold text-[#241814] mb-3 uppercase tracking-wider text-xs text-[#8c7b70]">Order summary</h4>
        <div className="space-y-3 py-3 text-sm border-t border-b border-[#f4eee6]">
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8c7b70]">Destination counter</span>
            <span className="font-semibold text-[#241814] font-mono text-xs">{job.shop_id}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8c7b70]">Document pages</span>
            <span className="font-semibold text-[#241814]">{job.page_count}</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8c7b70]">Quantity</span>
            <span className="font-semibold text-[#241814]">{job.copy_count} {job.copy_count === 1 ? 'copy' : 'copies'}</span>
          </div>
          <div className="flex items-center justify-between py-1 text-base">
            <span className="text-[#241814] font-semibold">Total cost</span>
            <span className="font-bold text-[#241814]">{job.currency} {job.total_cost}</span>
          </div>
        </div>
      </div>

      {/* Payment / Counter Claim Status Notice */}
      {isPending ? (
        <div className="p-4 rounded-2xl bg-[#fdf3ea] border border-[#f5d0b5] text-xs sm:text-sm text-[#8c4320] flex items-start gap-3">
          <Info className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <span>No payment has been taken. Real payments are disabled until a payment gateway provider is configured.</span>
        </div>
      ) : job.release_token ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-start gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm">Release Token Ready</p>
            <p className="font-mono text-base mt-1 font-bold tracking-widest">{job.release_token}</p>
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="space-y-3.5 pt-2">
        {job.document_id && (
          <Link
            href={`/account/print/new?doc=${encodeURIComponent(job.document_id)}`}
            className="w-full h-13 sm:h-14 px-6 rounded-2xl border-2 border-[#c05634] hover:bg-[#c05634]/10 text-[#c05634] text-base font-semibold flex items-center justify-center gap-2 transition-colors block text-center"
          >
            <span>Print again from saved file</span>
          </Link>
        )}

        <div className="text-right">
          <Link
            href="/help"
            className="text-xs sm:text-sm text-[#c05634] hover:underline inline-flex items-center gap-1 font-medium"
          >
            <span>Need counter support?</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
