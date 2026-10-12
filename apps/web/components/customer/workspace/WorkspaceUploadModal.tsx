'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, AlertCircle, FileText, Folder, FolderUp, CheckCircle2, Layers } from 'lucide-react';
import { uploadCustomerDocument, uploadCustomerDocumentsBatch } from '@/lib/api';

interface WorkspaceUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const VALID_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];
const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FOLDER_BYTES = 200 * 1024 * 1024; // 200 MB

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export default function WorkspaceUploadModal({ isOpen, onClose, onSuccess }: WorkspaceUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isFolder, setIsFolder] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetSelection = () => {
    setFiles([]);
    setFolderName(null);
    setIsFolder(false);
    setError('');
  };

  const processSingle = (file: File) => {
    setError('');
    if (!isSupportedFile(file)) {
      setError('Supported formats: PDF, PNG, JPG. Please convert other files to PDF first.');
      return;
    }
    if (file.size > MAX_SINGLE_FILE_BYTES) {
      setError('File exceeds maximum allowed size of 25 MB.');
      return;
    }
    setFiles([file]);
    setIsFolder(false);
    setFolderName(null);
  };

  const processBatchOrFolder = (selectedFiles: File[], detectedFolderName?: string) => {
    setError('');
    const valid = selectedFiles.filter(isSupportedFile);
    if (valid.length === 0) {
      setError('No supported PDF, PNG, or JPG files found in the selection.');
      return;
    }

    const totalBytes = valid.reduce((acc, f) => acc + f.size, 0);
    if (totalBytes > MAX_FOLDER_BYTES) {
      const mb = (totalBytes / (1024 * 1024)).toFixed(1);
      setError(`Combined folder upload (${mb} MB) exceeds maximum allowed limit of 200 MB.`);
      return;
    }

    if (valid.length === 1 && !detectedFolderName) {
      processSingle(valid[0]);
      return;
    }

    setFiles(valid);
    setIsFolder(Boolean(detectedFolderName || valid.length > 1));
    setFolderName(detectedFolderName || 'Selected documents');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) {
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length === 1) {
        processSingle(droppedFiles[0]);
      } else if (droppedFiles.length > 1) {
        processBatchOrFolder(droppedFiles);
      }
      return;
    }

    const collected: File[] = [];
    let detectedDir: string | undefined = undefined;
    let hasDir = false;

    async function traverseEntry(entry: any) {
      if (!entry) return;
      if (entry.isFile) {
        try {
          const file = await new Promise<File>((res, rej) => entry.file(res, rej));
          collected.push(file);
        } catch {}
      } else if (entry.isDirectory) {
        hasDir = true;
        if (!detectedDir) detectedDir = entry.name;
        const reader = entry.createReader();
        const readBatch = (): Promise<any[]> => new Promise((res, rej) => reader.readEntries(res, rej));
        let batch: any[] = [];
        do {
          try {
            batch = await readBatch();
            for (const child of batch) {
              await traverseEntry(child);
            }
          } catch {
            break;
          }
        } while (batch.length > 0);
      }
    }

    const promises: Promise<void>[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item.webkitGetAsEntry === 'function') {
        const entry = item.webkitGetAsEntry();
        if (entry) promises.push(traverseEntry(entry));
      } else {
        const f = item.getAsFile();
        if (f) collected.push(f);
      }
    }

    await Promise.all(promises);

    if (collected.length === 0) {
      const fallback = Array.from(e.dataTransfer.files || []);
      if (fallback.length === 1) processSingle(fallback[0]);
      else if (fallback.length > 1) processBatchOrFolder(fallback);
      return;
    }

    if (hasDir || collected.length > 1) {
      processBatchOrFolder(collected, detectedDir);
    } else {
      processSingle(collected[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) {
      setError('Please select a file or folder to upload.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      if (files.length === 1 && !isFolder) {
        await uploadCustomerDocument(files[0]);
      } else {
        await uploadCustomerDocumentsBatch(files);
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

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
            Store single documents or whole folders securely. Combined folder size up to 200 MB.
          </p>
        </div>

        {error && (
          <div className="p-3.5 mb-5 rounded-2xl bg-[#fee2e2] border border-[#fca5a5] text-xs text-[#991b1b] flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[#dc2626] flex-shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        <form onSubmit={handleUpload} className="space-y-5">
          {/* Hidden Inputs */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
            multiple
            onChange={(e) => {
              if (!e.target.files) return;
              if (e.target.files.length === 1) {
                processSingle(e.target.files[0]);
              } else if (e.target.files.length > 1) {
                processBatchOrFolder(Array.from(e.target.files));
              }
            }}
            className="hidden"
          />
          <input
            ref={folderInputRef}
            // @ts-expect-error webkitdirectory is standard in HTML5 for folder upload
            webkitdirectory=""
            directory=""
            multiple
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const list = Array.from(e.target.files);
                const dir = list[0]?.webkitRelativePath ? list[0].webkitRelativePath.split('/')[0] : undefined;
                processBatchOrFolder(list, dir);
              }
            }}
            className="hidden"
          />

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 sm:p-8 text-center transition-all ${
              isDragging
                ? 'border-[#c05634] bg-[#fbf5f2]'
                : files.length > 0
                ? 'border-[#c05634]/60 bg-[#fbf9f6]'
                : 'border-[#dcd4c8] hover:border-[#c05634] hover:bg-[#faf7f3]'
            }`}
          >
            {files.length > 0 ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl bg-[#c05634]/10 text-[#c05634] flex items-center justify-center">
                  {isFolder ? <Folder className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
                </div>
                <div className="text-center">
                  <p className="text-base font-bold text-[#241814] break-all">
                    {isFolder ? folderName : files[0].name}
                  </p>
                  <div className="flex items-center justify-center gap-2 text-xs text-[#66554b] mt-1">
                    <span>{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                    <span>•</span>
                    <span>{(totalSize / (1024 * 1024)).toFixed(2)} MB</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetSelection}
                  className="text-xs text-[#c05634] underline font-medium mt-1 cursor-pointer"
                >
                  Change selection
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#f4ece4] text-[#c05634] flex items-center justify-center">
                  <UploadCloud className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#241814]">
                    Drag & drop files or a folder here
                  </p>
                  <p className="text-xs text-[#8c7b70] mt-0.5">
                    Single file up to 25 MB · Combined folder up to 200 MB
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Choose file(s)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-50 text-[#3d2f28] border border-[#dcd4c8] hover:border-[#c05634] text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <FolderUp className="w-3.5 h-3.5 text-[#c05634]" />
                    <span>Choose folder</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <span className="text-xs text-[#8c7b70]">
              {files.length > 0 && isFolder && (
                <span className="inline-flex items-center gap-1 text-[#b85333] font-medium">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Will save {files.length} files to library</span>
                </span>
              )}
            </span>

            <div className="flex items-center gap-3">
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
                disabled={files.length === 0 || busy}
                className="px-6 py-2.5 rounded-xl bg-[#c05634] hover:bg-[#a94829] disabled:opacity-50 text-white text-xs sm:text-sm font-semibold transition-all shadow-md shadow-[#c05634]/20 flex items-center gap-2 cursor-pointer"
              >
                {busy ? (
                  <span>Saving to library…</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isFolder ? `Save ${files.length} files` : 'Save to library'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
