'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { FileText, Search, Printer, ChevronRight, Lock, HelpCircle, Trash2, Download, UploadCloud } from 'lucide-react';
import { CustomerDocument } from '@/lib/types';
import { deleteCustomerDocument } from '@/lib/api';

interface RecentDocumentsTableProps {
  documents: CustomerDocument[];
  loading?: boolean;
  onRefresh: () => void;
  onUploadClick?: () => void;
}

export default function RecentDocumentsTable({ documents, loading, onRefresh, onUploadClick }: RecentDocumentsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (doc: CustomerDocument) => {
    if (!window.confirm(`Remove "${doc.file_name}" from your private library?`)) return;
    setBusyId(doc.id);
    try {
      await deleteCustomerDocument(doc.id);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete document');
    } finally {
      setBusyId(null);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="bg-[#ffffff] border border-[#e6dfd5] rounded-3xl p-8 sm:p-10 lg:p-12 shadow-xs space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl sm:text-3xl font-serif text-[#241814] font-bold tracking-tight">
            My documents
          </h3>
          <p className="text-xs sm:text-sm text-[#66554b] mt-1">
            Recently stored files in your private cloud library
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-[#8c7b70] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search your documents…"
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border border-[#dcd4c8] bg-[#fdfbf9] text-sm text-[#241814] focus:outline-none focus:border-[#c05634] transition-colors"
            />
          </div>

          <Link
            href="/account/documents"
            className="px-5 py-2.5 rounded-2xl border-2 border-[#c05634] text-[#c05634] hover:bg-[#c05634]/10 text-sm font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <span>View all</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Table Content */}
      {loading ? (
        <div className="space-y-4 py-8 animate-pulse">
          <div className="h-12 bg-neutral-100 rounded-2xl" />
          <div className="h-16 bg-neutral-50 rounded-2xl" />
          <div className="h-16 bg-neutral-50 rounded-2xl" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-14 px-6 text-center border-2 border-dashed border-[#e6dfd5] rounded-3xl bg-[#faf7f3] space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-white border border-[#ded5c7] flex items-center justify-center text-[#c05634] mx-auto shadow-xs">
            <UploadCloud className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h4 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
              {searchTerm ? 'No matching documents found' : 'Your document library is empty'}
            </h4>
            <p className="text-sm sm:text-base text-[#66554b] leading-relaxed">
              {searchTerm
                ? 'Try a different search keyword or clear the search field to view all files.'
                : 'Upload PDFs, notes, or images to keep them ready for instant touchless counter printing.'}
            </p>
          </div>

          {!searchTerm && onUploadClick && (
            <div className="pt-2">
              <button
                type="button"
                onClick={onUploadClick}
                className="px-7 py-3 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm sm:text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
              >
                + Upload your first file
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 pt-4 text-xs text-[#8c7b70]">
            <span className="px-3 py-1 rounded-full bg-white border border-[#efe7dd]">📄 PDF (page count auto-inspected)</span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#efe7dd]">🖼️ PNG & JPEG</span>
            <span className="px-3 py-1 rounded-full bg-white border border-[#efe7dd]">🔒 Up to 25 MB per file</span>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[#efe7dd] text-[#8c7b70] text-xs font-semibold uppercase tracking-wider">
                <th className="py-4 px-4">File</th>
                <th className="py-4 px-4">Size</th>
                <th className="py-4 px-4">Added</th>
                <th className="py-4 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4eee6]">
              {filtered.slice(0, 5).map((doc) => (
                <tr key={doc.id} className="hover:bg-[#faf7f3] transition-colors group">
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-12 rounded-xl bg-[#f4eee6] border border-[#e6ded3] flex items-center justify-center text-[#8c7b70] flex-shrink-0">
                        <FileText className="w-5 h-5 text-[#a39484]" />
                      </div>
                      <div>
                        <p className="font-bold text-[#241814] truncate max-w-xs sm:max-w-md text-base">
                          {doc.file_name}
                        </p>
                        {doc.page_count && (
                          <span className="text-xs text-[#8c7b70]">
                            {doc.page_count} {doc.page_count === 1 ? 'page' : 'pages'}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-[#66554b] whitespace-nowrap text-sm font-medium">
                    {formatSize(doc.file_size_bytes)}
                  </td>
                  <td className="py-4 px-4 text-[#66554b] whitespace-nowrap text-sm">
                    {formatDate(doc.created_at)}
                  </td>
                  <td className="py-4 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-2">
                      <Link
                        href={`/account/print/new?doc=${encodeURIComponent(doc.id)}`}
                        className="px-4 py-2 rounded-xl border border-[#c05634] text-[#c05634] hover:bg-[#c05634] hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all"
                      >
                        <Printer className="w-4 h-4" />
                        <span>Print again</span>
                      </Link>

                      <a
                        href={`/api/backend/customer/documents/${encodeURIComponent(doc.id)}/download`}
                        download={doc.file_name}
                        className="p-2 rounded-xl border border-[#dcd4c8] text-[#66554b] hover:text-[#241814] hover:bg-neutral-100 transition-colors"
                        title="Download file"
                      >
                        <Download className="w-4 h-4" />
                      </a>

                      <button
                        type="button"
                        onClick={() => handleDelete(doc)}
                        disabled={busyId === doc.id}
                        className="p-2 rounded-xl border border-[#dcd4c8] text-[#a85a5a] hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                        title="Delete from library"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Bottom Footer Note */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-5 border-t border-[#f4eee6] text-xs sm:text-sm text-[#8c7b70]">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-[#c05634]" />
          <span>Saved documents stay private to your account.</span>
        </div>

        <Link href="/help" className="inline-flex items-center gap-1.5 text-[#c05634] hover:underline font-medium">
          <HelpCircle className="w-4 h-4" />
          <span>Need help printing?</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
