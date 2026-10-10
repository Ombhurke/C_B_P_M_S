'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, Clock, CheckCircle2, AlertCircle, ChevronRight, Inbox } from 'lucide-react';
import { CustomerJob } from '@/lib/types';

interface LatestJobCardProps {
  job: CustomerJob | null;
  loading?: boolean;
}

export default function LatestJobCard({ job, loading }: LatestJobCardProps) {
  if (loading) {
    return (
      <div className="bg-[#ffffff] border border-[#e6dfd5] rounded-3xl p-8 sm:p-10 lg:p-12 shadow-xs flex flex-col justify-between h-full min-h-[300px] animate-pulse">
        <div className="h-7 w-36 bg-neutral-200 rounded" />
        <div className="space-y-4 my-6">
          <div className="h-5 w-52 bg-neutral-200 rounded" />
          <div className="h-4 w-40 bg-neutral-200 rounded" />
        </div>
        <div className="h-12 w-full bg-neutral-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="bg-[#ffffff] border border-[#e6dfd5] rounded-3xl p-8 sm:p-10 lg:p-12 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between h-full min-h-[300px]">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-2xl sm:text-3xl font-serif text-[#241814] font-bold tracking-tight">
            Your latest job
          </h3>
          {job && (
            <span className="text-xs font-mono uppercase tracking-wider text-[#8c7b70]">
              Active
            </span>
          )}
        </div>

        {job ? (
          <div className="mt-6 flex items-start gap-4 p-4 rounded-2xl bg-[#faf6f0] border border-[#efe7dd]">
            <div className="w-14 h-16 rounded-xl bg-white border border-[#e8dfd3] flex items-center justify-center text-[#8c7b70] flex-shrink-0 shadow-xs">
              <FileText className="w-8 h-8 text-[#a39484]" />
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <p className="text-base sm:text-lg font-bold text-[#241814] truncate">
                {job.file_name}
              </p>

              <div>
                {job.payment_status === 'pending' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faebe6] text-[#b85333] text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting payment</span>
                  </span>
                ) : job.job_status === 'completed' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Completed</span>
                  </span>
                ) : job.job_status === 'queued' ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 text-xs font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Queued</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="capitalize">{job.job_status}</span>
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-[#66554b]">
                Copies: {job.copy_count} · Total: {job.currency} {job.total_cost}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex items-start gap-4 p-5 rounded-2xl bg-[#faf6f0] border border-[#efe7dd]">
            <div className="w-12 h-12 rounded-xl bg-white border border-[#e8dfd3] flex items-center justify-center text-[#8c7b70] flex-shrink-0">
              <Inbox className="w-6 h-6 text-[#a39484]" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-bold text-[#241814]">No active print requests</p>
              <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
                Your submitted print jobs will show progress here with live counter status, release code, and payment details.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 pt-2">
        {job ? (
          <Link
            href="/account/jobs"
            className="w-full h-13 sm:h-14 px-6 rounded-2xl border-2 border-[#c05634] hover:bg-[#c05634]/10 text-[#c05634] text-base sm:text-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>View job</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        ) : (
          <Link
            href="/account/print/new"
            className="w-full h-13 sm:h-14 px-6 rounded-2xl border-2 border-[#dcd4c8] hover:border-[#c05634] hover:text-[#c05634] text-[#3d2f28] text-base sm:text-lg font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <span>Prepare a print</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        )}
      </div>
    </div>
  );
}
