'use client';

import React from 'react';
import Link from 'next/link';
import { Files, Clock, ShieldCheck, HardDrive } from 'lucide-react';
import { CustomerDocument, CustomerJob } from '@/lib/types';

interface WorkspaceStatsShelfProps {
  documents: CustomerDocument[];
  latestJob: CustomerJob | null;
}

export default function WorkspaceStatsShelf({ documents, latestJob }: WorkspaceStatsShelfProps) {
  // Format total bytes across documents
  const totalBytes = documents.reduce((acc, doc) => acc + (doc.file_size_bytes || 0), 0);
  const formattedStorage =
    totalBytes === 0
      ? '0 KB'
      : totalBytes < 1024 * 1024
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <section aria-label="Workspace summary statistics" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
      {/* 1. Saved Documents Metric */}
      <Link
        href="/account/documents"
        className="bg-white border border-[#e6dfd5] hover:border-[#c05634]/40 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all group flex items-center justify-between"
      >
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-[#8c7b70]">
            Private Library
          </p>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-[#241814] group-hover:text-[#c05634] transition-colors">
            {documents.length} {documents.length === 1 ? 'document' : 'documents'}
          </p>
          <p className="text-xs text-[#66554b]">
            {documents.length > 0 ? 'Ready for repeat printing' : 'Save files for repeat printing'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] group-hover:bg-[#c05634] group-hover:text-white transition-all">
          <Files className="w-6 h-6" />
        </div>
      </Link>

      {/* 2. Print Queue Metric */}
      <Link
        href="/account/jobs"
        className="bg-white border border-[#e6dfd5] hover:border-[#c05634]/40 rounded-2xl p-5 sm:p-6 shadow-xs hover:shadow-md transition-all group flex items-center justify-between"
      >
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-[#8c7b70]">
            Print Queue
          </p>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-[#241814] group-hover:text-[#c05634] transition-colors">
            {latestJob ? '1 in progress' : '0 active'}
          </p>
          <p className="text-xs text-[#66554b]">
            {latestJob ? `Latest: ${latestJob.file_name}` : 'No submitted requests in flight'}
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] group-hover:bg-[#c05634] group-hover:text-white transition-all">
          <Clock className="w-6 h-6" />
        </div>
      </Link>

      {/* 3. Storage Usage Metric */}
      <div className="bg-white border border-[#e6dfd5] rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-[#8c7b70]">
            Storage Allocated
          </p>
          <p className="text-2xl sm:text-3xl font-serif font-bold text-[#241814]">
            {formattedStorage}
          </p>
          <p className="text-xs text-[#66554b]">
            PDF, PNG, JPG • Max 25 MB/file
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#8c7b70]">
          <HardDrive className="w-6 h-6" />
        </div>
      </div>

      {/* 4. Privacy Guarantee Metric */}
      <div className="bg-white border border-[#e6dfd5] rounded-2xl p-5 sm:p-6 shadow-xs flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-xs sm:text-sm font-medium uppercase tracking-wider text-[#8c7b70]">
            Privacy & Trust
          </p>
          <p className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
            Owner Isolated
          </p>
          <p className="text-xs text-[#66554b]">
            Encrypted • No third-party training
          </p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-emerald-600">
          <ShieldCheck className="w-6 h-6" />
        </div>
      </div>
    </section>
  );
}
