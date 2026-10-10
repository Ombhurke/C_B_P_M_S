'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, AlertCircle, FileText, CheckCircle2 } from 'lucide-react';
import { uploadCustomerDocument } from '@/lib/api';

interface WorkspaceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function WorkspaceUploadModal({ isOpen, onClose, onSuccess }: WorkspaceUploadModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError('');
    const extension = selectedFile.name.split('.').pop()?.toLowerCase();
    if (!['pdf', 'png', 'jpg', 'jpeg'].includes(extension || '')) {
      setError('Supported formats: PDF, PNG, JPG. Please convert other files to PDF first.');
      return;
    }
    if (selectedFile.size > 25 * 1024 * 1024) {
      setError('File exceeds maximum allowed size of 25 MB.');
      return;
    }
    setFile(selectedFile);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await uploadCustomerDocument(file);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-lg bg-[#ffffff] text-[#241814] rounded-3xl shadow-2xl border border-[#e6dfd5] p-6 sm:p-8 text-left animate-in fade-in zoom-in-95 duration-150">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute right-5 top-5 p-2 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <span className="text-xs font-mono uppercase tracking-wider text-[#c05634] font-semibold">
            Private Document Shelf
          </span>
          <h2 className="text-2xl font-serif text-[#241814] mt-1 font-bold">
            Upload to your library
          </h2>
          <p className="text-xs sm:text-sm text-[#66554b] mt-1">
            Store documents securely in your account for printing anytime across CBPMS counters.
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-5 rounded-2xl bg-[#fee2e2] border border-[#fca5a5] text-xs text-[#991b1b] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#dc2626] flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-[#c05634] bg-[#fbf5f2]'
                : file
                ? 'border-[#c05634]/60 bg-[#fbf9f6]'
                : 'border-[#dcd4c8] hover:border-[#c05634] hover:bg-[#faf7f3]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => e.target.files?.[0] && validateAndSetFile(e.target.files[0])}
              className="hidden"
            />

            {file ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-[#c05634]/10 text-[#c05634] flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <p className="text-sm font-semibold text-[#241814] break-all">{file.name}</p>
                <p className="text-xs text-[#66554b]">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                <span className="text-[11px] text-[#c05634] underline mt-1">Change file</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 rounded-2xl bg-[#f4ece4] text-[#c05634] flex items-center justify-center mb-1">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <p className="text-sm font-medium text-[#241814]">
                  Drag & drop your file here, or <span className="text-[#c05634] font-semibold underline">browse</span>
                </p>
                <p className="text-xs text-[#8c7b70]">PDF, PNG, or JPEG · Maximum 25 MB</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="px-5 py-2.5 rounded-xl border border-[#dcd4c8] hover:bg-neutral-100 text-xs sm:text-sm font-medium text-[#3d2f28] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || busy}
              className="px-6 py-2.5 rounded-xl bg-[#c05634] hover:bg-[#a94829] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-[#c05634]/20 flex items-center gap-2 cursor-pointer"
            >
              {busy ? (
                <span>Saving to library…</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save to library</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
