'use client';

import React from 'react';
import Link from 'next/link';
import { FileText, Printer, MoreVertical, Download, Trash2 } from 'lucide-react';
import { CustomerDocument } from '@/lib/types';

interface DocumentGridCardProps {
  document: CustomerDocument;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (doc: CustomerDocument) => void;
}

export default function DocumentGridCard({
  document: doc,
  isSelected,
  onSelect,
  onDelete,
}: DocumentGridCardProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isPdf = doc.mime_type === 'application/pdf';

  return (
    <div
      onClick={onSelect}
      className={`relative bg-[#ffffff] rounded-3xl p-6 sm:p-7 border transition-all cursor-pointer text-left flex flex-col justify-between shadow-xs hover:shadow-md ${
        isSelected
          ? 'border-[#c05634] ring-2 ring-[#c05634]/20 shadow-md'
          : 'border-[#e6dfd5] hover:border-[#c05634]/50'
      }`}
    >
      <div className="flex items-start gap-5">
        {/* Document Thumbnail Preview Sheet Plate */}
        <div className="w-20 h-26 sm:w-24 sm:h-30 rounded-2xl bg-[#faf6f0] border border-[#e8dfd3] flex-shrink-0 flex items-center justify-center p-2.5 relative shadow-xs">
          <div className="w-full h-full bg-white border border-[#ded5c7] rounded-lg p-2 flex flex-col justify-between shadow-xs">
            <div className="space-y-1.5 opacity-60">
              <div className="w-10 h-1.5 bg-[#a39484] rounded" />
              <div className="w-12 h-1 bg-[#d4c8bb] rounded" />
              <div className="w-11 h-1 bg-[#d4c8bb] rounded" />
              <div className="w-8 h-1 bg-[#d4c8bb] rounded" />
            </div>
            <FileText className="w-4 h-4 text-[#a39484] self-end" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-6">
          <h3 className="text-lg sm:text-xl font-bold text-[#241814] truncate leading-snug">
            {doc.file_name}
          </h3>
          <p className="text-sm text-[#66554b] mt-1.5 font-medium">
            {isPdf ? 'PDF' : 'Image'} · {doc.page_count ? `${doc.page_count} pages · ` : ''}{formatSize(doc.file_size_bytes)}
          </p>
          <span className="inline-block mt-2 text-xs font-mono px-2 py-0.5 rounded bg-[#f4eee6] text-[#66554b]">
            Private library
          </span>
        </div>
      </div>

      {/* Action Buttons Row */}
      <div className="mt-6 pt-4 flex items-center justify-between border-t border-[#f4eee6]">
        <Link
          href={`/account/print/new?doc=${encodeURIComponent(doc.id)}`}
          onClick={(e) => e.stopPropagation()}
          className="h-11 px-5 rounded-xl border-2 border-[#c05634] text-[#c05634] hover:bg-[#c05634] hover:text-white text-sm font-semibold inline-flex items-center gap-2 transition-all shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>Print again</span>
        </Link>

        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-2.5 rounded-xl text-[#8c7b70] hover:text-[#241814] hover:bg-neutral-100 transition-colors cursor-pointer"
            aria-label="Document options"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 bottom-full mb-1 w-48 rounded-2xl bg-white border border-[#e6dfd5] shadow-xl p-2 z-20"
            >
              <a
                href={`/api/backend/customer/documents/${encodeURIComponent(doc.id)}/download`}
                download={doc.file_name}
                onClick={() => setMenuOpen(false)}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-[#241814] hover:bg-[#faf6f0] flex items-center gap-2.5"
              >
                <Download className="w-4 h-4 text-[#66554b]" />
                <span>Download file</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(doc);
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-red-700 hover:bg-red-50 flex items-center gap-2.5 cursor-pointer mt-0.5"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                <span>Delete document</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
