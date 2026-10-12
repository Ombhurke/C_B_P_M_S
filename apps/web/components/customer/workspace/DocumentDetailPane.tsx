'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Lock, Printer, Download, Trash2, FileText, Info, ZoomIn, AlertTriangle } from 'lucide-react';
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!doc) {
    return (
      <div className="bg-white rounded-3xl p-8 sm:p-10 border border-[#e6dfd5] text-center shadow-xs h-full flex flex-col items-center justify-center min-h-[460px] text-[#8c7b70]">
        <div className="w-16 h-16 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#d4c8bb] mb-3">
          <Info className="w-8 h-8" />
        </div>
        <p className="text-xl font-serif font-bold text-[#241814]">No document selected</p>
        <p className="text-sm text-[#8c7b70] mt-1.5 max-w-xs leading-relaxed">
          Select any document from your library to view detailed metadata, inspect the authorized file, or prepare a print job.
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
  const downloadUrl = `/api/backend/customer/documents/${encodeURIComponent(doc.id)}/download`;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#e6dfd5] shadow-xs text-left space-y-6">
      {/* Breadcrumb & Title */}
      <div>
        <div className="text-xs text-[#8c7b70] mb-1 font-medium">
          My prints / Document details
        </div>
        <h3 className="text-2xl font-serif text-[#241814] font-bold tracking-tight break-all leading-snug">
          {doc.file_name}
        </h3>
      </div>

      {/* Authorized File Preview Container */}
      <div className="rounded-2xl border border-[#e6dfd5] overflow-hidden bg-[#ede8de] shadow-inner">
        <div className="px-4 py-2 bg-[#faf6f0] border-b border-[#e6dfd5] flex items-center justify-between text-xs text-[#66554b]">
          <span className="font-semibold text-[#241814]">
            {doc.page_count ? `Page 1 of ${doc.page_count}` : 'Authorized preview'}
          </span>
          <span className="flex items-center gap-1 text-[#8c7b70]">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>100%</span>
          </span>
        </div>
        <div className="p-3">
          <iframe
            src={downloadUrl}
            className="w-full h-64 sm:h-72 rounded-xl bg-white border border-[#ded5c7]"
            title={doc.file_name}
          />
        </div>
      </div>

      {/* Details Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
            In your private library
          </span>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf3ea] text-[#c05634] text-xs font-semibold">
            <Lock className="w-3.5 h-3.5" />
            <span>Only you</span>
          </div>
        </div>

        <div className="space-y-2.5 py-3 text-xs sm:text-sm border-t border-b border-[#f4eee6]">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[#8c7b70]">Format</span>
            <span className="font-semibold text-[#241814]">{isPdf ? 'PDF' : 'Image'}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[#8c7b70]">Pages</span>
            <span className="font-semibold text-[#241814]">{doc.page_count || 1}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[#8c7b70]">Size</span>
            <span className="font-semibold text-[#241814]">{formatSize(doc.file_size_bytes)}</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[#8c7b70]">Privacy</span>
            <span className="font-semibold text-[#241814]">Only you</span>
          </div>
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[#8c7b70]">Added</span>
            <span className="font-semibold text-[#241814]">{formatDate(doc.created_at)}</span>
          </div>
        </div>
      </div>

      {/* Educational Notice (Visual 05) */}
      <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] text-xs text-[#66554b] leading-relaxed">
        <p className="font-bold text-[#241814] mb-1">About saved files</p>
        <span>
          Your library copy remains private until you delete it. Shops receive access only for jobs you assign to them.
        </span>
      </div>

      {/* Active Print Status */}
      <div className="p-3.5 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] text-xs text-[#66554b] flex items-center justify-between">
        <span>Active print jobs:</span>
        <span className="font-semibold text-[#241814]">
          {doc.latest_job_status ? `Job status: ${doc.latest_job_status}` : 'No active print jobs'}
        </span>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-1">
        <Link
          href={`/account/print/new?doc=${encodeURIComponent(doc.id)}`}
          className="w-full h-12 sm:h-13 px-6 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold flex items-center justify-center gap-2.5 shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
        >
          <Printer className="w-5 h-5" />
          <span>Print this document</span>
        </Link>

        <a
          href={downloadUrl}
          download={doc.file_name}
          className="w-full h-12 sm:h-13 px-6 rounded-2xl border-2 border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-base font-semibold flex items-center justify-center gap-2.5 transition-colors block text-center"
        >
          <Download className="w-5 h-5" />
          <span>Download file</span>
        </a>

        {/* Delete Document with Accessible Confirmation */}
        <div className="pt-2">
          {!confirmDelete ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="w-full py-2 text-sm font-semibold text-red-700 hover:text-red-900 transition-colors cursor-pointer text-center"
            >
              Delete document
            </button>
          ) : (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs space-y-2 text-left">
              <div className="flex items-center gap-1.5 text-red-800 font-bold">
                <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0" />
                <span>Permanently delete this file?</span>
              </div>
              <p className="text-red-700">
                This permanently purges this document from your private cloud storage.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={busyDeleting}
                  onClick={() => {
                    onDelete(doc);
                    setConfirmDelete(false);
                  }}
                  className="flex-1 py-2 px-3 rounded-xl bg-red-700 text-white font-semibold hover:bg-red-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {busyDeleting ? 'Deleting…' : 'Yes, delete file'}
                </button>
                <button
                  type="button"
                  disabled={busyDeleting}
                  onClick={() => setConfirmDelete(false)}
                  className="py-2 px-3 rounded-xl border border-neutral-300 text-neutral-700 hover:bg-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
