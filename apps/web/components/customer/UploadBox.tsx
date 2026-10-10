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
    const validExtensions = ['.pdf', '.jpg', '.jpeg', '.png'];
    const hasValidExt = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      setError('Upload a PDF, PNG, or JPG. Export Word documents to PDF first.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File exceeds 25MB maximum size ceiling.');
      return;
    }

    // Client-side heuristic for page count
    let estimatedPages = 1;
    if (file.name.toLowerCase().endsWith('.pdf')) {
      // Rough preview only; the server replaces this with the parsed page count.
      estimatedPages = Math.max(1, Math.min(50, Math.ceil(file.size / 150000)));
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
          className={`relative border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 ${
            isDragging
              ? 'border-[#ea7c50] bg-[#ea7c50]/15 scale-[1.01]'
              : 'border-[#f5efe6]/15 hover:border-[#ea7c50]/60 bg-[#231a14]/60 hover:bg-[#231a14]/90'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            accept=".pdf,.jpg,.jpeg,.png"
            className="hidden"
          />
          <div className="w-16 h-16 rounded-2xl bg-[#ea7c50]/15 border border-[#ea7c50]/30 flex items-center justify-center mb-4 text-[#ea7c50]">
            <UploadCloud className="w-8 h-8 animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-[#fbf9f5] mb-1">
            Tap to upload or drag document here
          </h3>
          <p className="text-xs text-[#ba9e88] max-w-xs mb-3">
            Supports PDF, JPG, PNG up to 25MB. The server verifies pages before checkout.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-[#ea7c50] font-medium bg-[#ea7c50]/10 px-3.5 py-1 rounded-full border border-[#ea7c50]/25">
            <span>🔒 Ephemeral transit – Files purged after printing</span>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-5 border border-[#ea7c50]/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#ea7c50]/20 border border-[#ea7c50]/30 flex items-center justify-center text-[#ea7c50] flex-shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-[#fbf9f5] truncate text-sm">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-xs text-[#ba9e88] mt-0.5">
                <span>{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                <span>•</span>
                <span className="text-[#ea7c50] font-medium">{pageCount} pages estimated · verified at checkout</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-2 text-[#ba9e88] hover:text-[#f87171] hover:bg-[#f87171]/10 rounded-xl transition-colors"
            title="Remove file"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2 text-xs text-[#fca5a5] bg-[#451a1a]/70 border border-[#f87171]/30 p-3 rounded-2xl">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
