'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
  Store,
  FileText,
  Printer,
  ShieldAlert,
  Copy,
  Check,
} from 'lucide-react';
import { CustomerJob } from '@/lib/types';

interface JobDetailPaneProps {
  job: CustomerJob | null;
}

export default function JobDetailPane({ job }: JobDetailPaneProps) {
  const [copied, setCopied] = useState(false);

  if (!job) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e6dfd5] text-center shadow-xs h-full flex flex-col items-center justify-center min-h-[460px] text-[#8c7b70]">
        <div className="w-16 h-16 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#d4c8bb] mb-3">
          <Inbox className="w-8 h-8" />
        </div>
        <p className="text-xl font-serif font-bold text-[#241814]">No print job selected</p>
        <p className="text-sm text-[#8c7b70] mt-1.5 max-w-xs leading-relaxed">
          Select any print request from your history list to review order specifications, transparent pricing, and counter pickup details.
        </p>
      </div>
    );
  }

  const hasReleaseToken = Boolean(job.release_token);
  const isPaidOnline = (job.payment_status === 'completed' || job.payment_status === 'paid') && job.payment_method !== 'counter';
  const isCounterPayment = job.payment_method === 'counter';
  const isAwaitingPayment = job.payment_status === 'pending' && !isCounterPayment;
  const isCompleted = job.job_status === 'completed';
  const isQueued = job.job_status === 'queued';
  const isProcessing = job.job_status === 'processing';

  const handleCopy = async () => {
    if (!job.release_token) return;
    try {
      await navigator.clipboard.writeText(job.release_token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e6dfd5] shadow-xs text-left space-y-6">
      {/* Title & Status Pill */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
            Job specifications
          </span>
          {isCompleted ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Printed at counter</span>
            </span>
          ) : isPaidOnline ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Payment verified</span>
            </span>
          ) : isCounterPayment ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf3ea] border border-[#f5d0b5] text-[#8c4320] text-xs font-semibold">
              <Store className="w-3.5 h-3.5 text-[#c05634]" />
              <span>Pay at counter</span>
            </span>
          ) : isAwaitingPayment ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faebe6] text-[#b85333] text-xs font-semibold">
              <Clock className="w-3.5 h-3.5" />
              <span>Awaiting payment</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
              <AlertCircle className="w-3.5 h-3.5" />
              <span className="capitalize">{job.job_status}</span>
            </span>
          )}
        </div>

        <h3 className="text-2xl font-serif text-[#241814] font-bold tracking-tight break-all leading-snug">
          {isCompleted
            ? 'Print completed.'
            : hasReleaseToken
            ? 'Your print is ready for release.'
            : job.file_name}
        </h3>
      </div>

      {/* Large Cream Receipt Card (Visual 04) */}
      <div className="rounded-2xl border border-[#e6dfd5] bg-[#faf6f0] p-6 space-y-4 text-left shadow-xs">
        <div className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
          Job Details
        </div>

        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-[#c05634] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-[#241814] text-base">{job.file_name}</p>
              <p className="text-xs text-[#66554b]">
                {job.page_count} pages · {job.copy_count} {job.copy_count === 1 ? 'copy' : 'copies'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Store className="w-5 h-5 text-[#8c7b70] flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-[#241814]">{job.shop_id}</p>
              <p className="text-xs text-[#8c7b70]">Counter pickup</p>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between text-xs text-[#66554b] border-t border-[#e6dfd5]">
            <span>Privacy mode</span>
            <span className="font-semibold text-[#241814] capitalize">
              {job.access_mode === 'anonymous' ? 'Anonymous job' : 'Account-linked'}
            </span>
          </div>

          <div className="flex items-center justify-between text-xs text-[#66554b]">
            <span>Order total</span>
            <span className="font-mono font-bold text-sm text-[#241814]">
              {job.currency} {job.total_cost}
            </span>
          </div>
        </div>

        {/* Dashed Separator */}
        <div className="border-t-2 border-dashed border-[#ded5c7] my-4" />

        {/* Release Code Section */}
        {hasReleaseToken && job.release_token ? (
          <div className="bg-white rounded-2xl border-2 border-[#e6dfd5] p-5 text-center space-y-2 shadow-xs">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#8c7b70] px-1">
              <span>{isCounterPayment ? 'Counter pickup PIN' : 'Release code'}</span>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {isCompleted ? 'Printed' : 'Ready'}
              </span>
            </div>
            <div className="flex items-center justify-center gap-3 pt-1">
              <span className="font-mono text-3xl sm:text-4xl font-black tracking-widest text-[#241814] select-all">
                {job.release_token}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copy release code"
                className="p-2 rounded-xl border border-[#dcd4c8] hover:bg-[#faf6f0] text-[#66554b] hover:text-[#241814] transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-[#66554b] pt-0.5">
              {isCompleted
                ? 'Print job released and completed at the counter.'
                : isCounterPayment
                ? 'Show at counter · Pay cash or UPI upon collection'
                : 'Share this 4-digit code at the counter for print release'}
            </p>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-white border border-[#e6dfd5] text-center space-y-1">
            <p className="text-sm font-bold text-[#8c7b70]">
              Your release code appears here
            </p>
            <p className="text-xs text-[#8c7b70]">
              Issued only after verified payment or counter pickup selection.
            </p>
          </div>
        )}
      </div>

      {/* Progress Track (Visual 04) */}
      <div className="bg-[#faf6f0] border border-[#e6dfd5] rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">Job progress</h4>
        <div className="space-y-2.5 text-xs text-[#241814]">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 flex-shrink-0" />
            <span className="font-medium">1. Document uploaded</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isPaidOnline || isCompleted
                  ? 'bg-emerald-600'
                  : isCounterPayment
                  ? 'bg-amber-500'
                  : 'bg-neutral-300'
              }`}
            />
            <span
              className={
                isPaidOnline || isCompleted || isCounterPayment ? 'font-medium' : 'text-[#8c7b70]'
              }
            >
              {isCounterPayment ? '2. Pay at counter (Pending)' : '2. Payment verified'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isCompleted
                  ? 'bg-emerald-600'
                  : isQueued || isProcessing
                  ? 'bg-amber-500'
                  : 'bg-neutral-300'
              }`}
            />
            <span className={isQueued || isProcessing || isCompleted ? 'font-medium' : 'text-[#8c7b70]'}>
              3. Waiting at counter
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                isCompleted ? 'bg-emerald-600' : 'bg-neutral-300'
              }`}
            />
            <span className={isCompleted ? 'font-medium' : 'text-[#8c7b70]'}>4. Printed</span>
          </div>
        </div>
      </div>

      {/* Guidance Notice */}
      {isAwaitingPayment && (
        <div className="p-4 rounded-2xl bg-[#fdf3ea] border border-[#f5d0b5] text-xs text-[#8c4320] flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Payment pending. Complete checkout to generate your release code.
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3 pt-1">
        {job.document_id && (
          <Link
            href={`/account/print/new?doc=${encodeURIComponent(job.document_id)}`}
            className="w-full h-12 sm:h-13 px-6 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold flex items-center justify-center gap-2.5 shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
          >
            <Printer className="w-5 h-5" />
            <span>Print again from saved file</span>
          </Link>
        )}

        <Link
          href="/help"
          className="w-full h-12 sm:h-13 px-6 rounded-2xl border-2 border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-base font-semibold flex items-center justify-center gap-2.5 transition-colors block text-center"
        >
          <span>Need counter support?</span>
        </Link>
      </div>

      <p className="text-[11px] text-[#8c7b70] text-center">
        {isCompleted
          ? 'Print job completed and collected.'
          : hasReleaseToken
          ? 'Present this 4-digit PIN at the counter for immediate print release.'
          : 'Secure server-managed print workflow'}
      </p>
    </div>
  );
}
