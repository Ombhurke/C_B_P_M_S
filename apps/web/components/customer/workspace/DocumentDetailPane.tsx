'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Printer, Download, Trash2, FileText, Info } from 'lucide-react';
import { CustomerDocument } from '@/lib/types';

interface DocumentDetailPaneProps {
  document: CustomerDocument | null;
  onDelete: (doc: CustomerDocument) => void;
  busyDeleting?: boolean;
}

export default function DocumentDetailPane({
  document: doc,
  onDelete,
  busyDeleting,
}: DocumentDetailPaneProps) {
  if (!doc) {
    return (
      <div className="bg-[#ffffff] rounded-3xl p-10 border border-[#e6dfd5] text-center shadow-xs h-full flex flex-col items-center justify-center min-h-[460px] text-[#8c7b70]">
        <div className="w-16 h-16 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#d4c8bb] mb-3">
          <Info className="w-8 h-8" />
        </div>
        <p className="text-lg font-serif font-bold text-[#241814]">No document selected</p>
        <p className="text-sm text-[#8c7b70] mt-1.5 max-w-xs leading-relaxed">
          Select any document from your library to view detailed metadata, download, or prepare a print job.
        </p>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const isPdf = doc.mime_type === 'application/pdf';

  return (
    <div className="bg-[#ffffff] rounded-3xl p-8 sm:p-10 border border-[#e6dfd5] shadow-xs text-left space-y-6">
      <h3 className="text-2xl sm:text-3xl font-serif text-[#241814] font-bold tracking-tight">
        Document details
      </h3>

      {/* Large Thumbnail Preview Plate */}
      <div className="w-full h-48 sm:h-56 rounded-2xl bg-[#faf6f0] border border-[#e8dfd3] flex items-center justify-center p-4 shadow-inner">
        <div className="w-32 h-40 bg-white border border-[#ded5c7] rounded-xl shadow-md p-3.5 flex flex-col justify-between">
          <div className="space-y-2 opacity-60">
            <div className="w-16 h-2 bg-[#a39484] rounded" />
            <div className="w-22 h-1 bg-[#d4c8bb] rounded" />
            <div className="w-18 h-1 bg-[#d4c8bb] rounded" />
            <div className="w-14 h-1 bg-[#d4c8bb] rounded" />
          </div>
          <FileText className="w-7 h-7 text-[#a39484] self-end opacity-70" />
        </div>
      </div>

      {/* Title & Privacy Badge */}
      <div className="space-y-2.5">
        <h4 className="text-xl sm:text-2xl font-serif font-bold text-[#241814] break-all leading-snug">
          {doc.file_name}
        </h4>
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f4eee6] text-[#66554b] text-xs sm:text-sm font-medium">
          <Lock className="w-4 h-4 text-[#c05634]" />
          <span>Private to your account</span>
        </div>
      </div>

      {/* Metadata Table */}
      <div className="space-y-3.5 py-3 text-sm border-t border-b border-[#f4eee6]">
        <div className="flex items-center justify-between py-1">
          <span className="text-[#8c7b70]">Document format</span>
          <span className="font-semibold text-[#241814]">{isPdf ? 'PDF document' : 'Image file'}</span>
        </div>
        {doc.page_count && (
          <div className="flex items-center justify-between py-1">
            <span className="text-[#8c7b70]">Inspected pages</span>
            <span className="font-semibold text-[#241814]">{doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}</span>
          </div>
        )}
        <div className="flex items-center justify-between py-1">
          <span className="text-[#8c7b70]">File size</span>
          <span className="font-semibold text-[#241814]">{formatSize(doc.file_size_bytes)}</span>
        </div>
        <div className="flex items-center justify-between py-1">
          <span className="text-[#8c7b70]">Upload date</span>
          <span className="font-semibold text-[#241814]">{formatDate(doc.created_at)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3.5 pt-1">
        <Link
          href={`/account/print/new?doc=${encodeURIComponent(doc.id)}`}
          className="w-full h-13 sm:h-14 px-6 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold flex items-center justify-center gap-2.5 shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
        >
          <Printer className="w-5 h-5" />
          <span>Print this document</span>
        </Link>

        <a
          href={`/api/backend/customer/documents/${encodeURIComponent(doc.id)}/download`}
          download={doc.file_name}
          className="w-full h-13 sm:h-14 px-6 rounded-2xl border-2 border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-base font-semibold flex items-center justify-center gap-2.5 transition-colors block text-center"
        >
          <Download className="w-5 h-5" />
          <span>Download file</span>
        </a>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onDelete(doc)}
            disabled={busyDeleting}
            className="text-sm font-semibold text-red-700 hover:text-red-900 hover:underline cursor-pointer transition-colors"
          >
            {busyDeleting ? 'Deleting document…' : 'Delete document from library'}
          </button>
        </div>
      </div>

      <p className="text-xs text-[#8c7b70] text-center leading-relaxed">
        Printing creates a new job with your chosen shop and options.
      </p>
    </div>
  );
}
