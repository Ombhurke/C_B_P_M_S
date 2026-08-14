'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';

interface UploadBoxProps {
  onFileSelect: (file: File, extractedPages: number) => void;
  onClear: () => void;
  selectedFile: File | null;
  pageCount: number;
}

export default function UploadBox({ onFileSelect, onClear, selectedFile, pageCount }: UploadBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    setError(null);
    const validExtensions = ['.pdf', '.docx', '.jpg', '.jpeg', '.png'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError('Unsupported file type. Please upload a .pdf, .docx, .png, or .jpg file.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File exceeds 25MB maximum size ceiling.');
      return;
    }

    // Client-side heuristic for page count
    let estimatedPages = 1;
    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Estimate based on size or default to 4 pages for preview
      estimatedPages = Math.max(1, Math.min(50, Math.ceil(file.size / 150000)));
    } else if (file.name.toLowerCase().endsWith('.docx')) {
      estimatedPages = Math.max(1, Math.ceil(file.size / 200000));
    }

    onFileSelect(file, estimatedPages);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full">
      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
              : 'border-slate-700 hover:border-sky-500/50 bg-slate-900/60 hover:bg-slate-900/90'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            accept=".pdf,.docx,.jpg,.jpeg,.png"
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4 text-sky-400">
            <UploadCloud className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">
            Tap to upload or drag document here
          </h3>
          <p className="text-xs text-slate-400 max-w-xs mb-3">
            Supports PDF, DOCX, JPG, PNG up to 25MB. Zero signup required.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-sky-400 font-medium bg-sky-950/60 px-3 py-1 rounded-full border border-sky-800/40">
            <span>🔒 Ephemeral transit – Files purged after printing</span>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl p-5 border border-sky-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center text-sky-400 flex-shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-white truncate text-sm">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                <span>•</span>
                <span className="text-sky-400 font-medium">{pageCount} Pages detected</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Remove file"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
