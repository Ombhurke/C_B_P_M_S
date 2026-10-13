'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, Folder, FolderUp, AlertCircle, Trash2, Layers } from 'lucide-react';

interface UploadBoxProps {
  onFileSelect: (
    file: File,
    extractedPages: number,
    folderFiles?: File[],
    isFolder?: boolean,
    folderName?: string
  ) => void;
  onClear: () => void;
  selectedFile: File | null;
  pageCount: number;
  isFolder?: boolean;
  folderFiles?: File[];
  folderName?: string;
}

const VALID_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const MAX_FOLDER_BYTES = 200 * 1024 * 1024; // 200 MB

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return VALID_EXTENSIONS.some((ext) => name.endsWith(ext));
}

function estimatePagesForFile(file: File): number {
  if (file.name.toLowerCase().endsWith('.pdf')) {
    return Math.max(1, Math.min(50, Math.ceil(file.size / 150000)));
  }
  return 1;
}

export default function UploadBox({
  onFileSelect,
  onClear,
  selectedFile,
  pageCount,
  isFolder = false,
  folderFiles,
  folderName,
}: UploadBoxProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const processSingleFile = (file: File) => {
    setError(null);
    if (!isSupportedFile(file)) {
      setError('Upload a PDF, PNG, or JPG. Export Word documents to PDF first.');
      return;
    }

    if (file.size > MAX_SINGLE_FILE_BYTES) {
      setError('Single file exceeds the 25 MB maximum size ceiling.');
      return;
    }

    const estimatedPages = estimatePagesForFile(file);
    onFileSelect(file, estimatedPages, [file], false, file.name);
  };

  const processMultipleFilesOrFolder = (files: File[], detectedFolderName?: string) => {
    setError(null);
    const valid = files.filter(isSupportedFile);

    if (valid.length === 0) {
      setError('No supported PDF, PNG, or JPG files found in the folder.');
      return;
    }

    const combinedBytes = valid.reduce((acc, f) => acc + f.size, 0);
    if (combinedBytes > MAX_FOLDER_BYTES) {
      const mb = (combinedBytes / (1024 * 1024)).toFixed(1);
      setError(`Combined folder size (${mb} MB) exceeds the 200 MB maximum limit.`);
      return;
    }

    if (valid.length === 1 && !detectedFolderName) {
      processSingleFile(valid[0]);
      return;
    }

    let totalPages = 0;
    for (const f of valid) {
      totalPages += estimatePagesForFile(f);
    }

    const name = detectedFolderName || (valid[0].webkitRelativePath ? valid[0].webkitRelativePath.split('/')[0] : 'Folder_Bundle');
    const representative = new File([valid[0]], `${name}.pdf`, { type: 'application/pdf' });

    onFileSelect(representative, totalPages, valid, true, name);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (!items || items.length === 0) {
      const droppedFiles = Array.from(e.dataTransfer.files || []);
      if (droppedFiles.length === 1) {
        processSingleFile(droppedFiles[0]);
      } else if (droppedFiles.length > 1) {
        processMultipleFilesOrFolder(droppedFiles);
      }
      return;
    }

    const collectedFiles: File[] = [];
    let detectedDirName: string | undefined = undefined;
    let hasDirectory = false;

    async function traverseEntry(entry: any) {
      if (!entry) return;
      if (entry.isFile) {
        try {
          const file = await new Promise<File>((res, rej) => entry.file(res, rej));
          collectedFiles.push(file);
        } catch { }
      } else if (entry.isDirectory) {
        hasDirectory = true;
        if (!detectedDirName) detectedDirName = entry.name;
        const reader = entry.createReader();
        const readEntriesBatch = (): Promise<any[]> =>
          new Promise((res, rej) => reader.readEntries(res, rej));
        let batch: any[] = [];
        do {
          try {
            batch = await readEntriesBatch();
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
        const file = item.getAsFile();
        if (file) collectedFiles.push(file);
      }
    }

    await Promise.all(promises);

    if (collectedFiles.length === 0) {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const fallbackList = Array.from(e.dataTransfer.files);
        if (fallbackList.length === 1) {
          processSingleFile(fallbackList[0]);
        } else {
          processMultipleFilesOrFolder(fallbackList);
        }
      }
      return;
    }

    if (hasDirectory || collectedFiles.length > 1) {
      processMultipleFilesOrFolder(collectedFiles, detectedDirName);
    } else {
      processSingleFile(collectedFiles[0]);
    }
  };

  const combinedSize = folderFiles ? folderFiles.reduce((acc, f) => acc + f.size, 0) : selectedFile?.size || 0;

  return (
    <div className="w-full">
      {/* Hidden File and Folder Inputs */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (!e.target.files) return;
          if (e.target.files.length === 1) {
            processSingleFile(e.target.files[0]);
          } else if (e.target.files.length > 1) {
            processMultipleFilesOrFolder(Array.from(e.target.files));
          }
        }}
        accept=".pdf,.jpg,.jpeg,.png"
        multiple
        className="hidden"
      />
      <input
        type="file"
        ref={folderInputRef}
        // @ts-expect-error webkitdirectory is standard in HTML5 for folder upload
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            const list = Array.from(e.target.files);
            const dirName = list[0]?.webkitRelativePath ? list[0].webkitRelativePath.split('/')[0] : undefined;
            processMultipleFilesOrFolder(list, dirName);
          }
        }}
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative border-2 border-dashed rounded-3xl p-8 sm:p-11 flex flex-col items-center justify-center text-center transition-all duration-200 ${isDragging
              ? 'border-[#c05634] bg-[#fdf3ea] scale-[1.005]'
              : 'border-[#e6dfd5] bg-[#faf6f0] hover:bg-[#f5ede3] hover:border-[#c05634]/60'
            }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-[#fdf3ea] border border-[#f5d0b5] flex items-center justify-center mb-4 text-[#c05634]">
            <UploadCloud className="w-8 h-8" />
          </div>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#241814] mb-1.5">
            Drop your document or folder here
          </h3>
          <p className="text-sm text-[#66554b] max-w-md mb-6 leading-relaxed">
            PDF, PNG or JPEG · Single file up to 25 MB · Combined folder up to 200 MB
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 min-h-[48px] rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm sm:text-base font-semibold transition-all shadow-md shadow-[#c05634]/20 cursor-pointer flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              <span>Choose file(s)</span>
            </button>

            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="px-6 py-3 min-h-[48px] rounded-xl bg-white hover:bg-neutral-50 text-[#3d2f28] border-2 border-[#dcd4c8] hover:border-[#c05634]/60 text-sm sm:text-base font-semibold transition-all cursor-pointer flex items-center gap-2"
            >
              <FolderUp className="w-4 h-4 text-[#c05634]" />
              <span>Choose folder</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#e6dfd5] shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] flex-shrink-0">
              {isFolder ? <Folder className="w-7 h-7" /> : <FileText className="w-7 h-7" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-[#241814] truncate text-base sm:text-lg">
                  {folderName || selectedFile.name}
                </p>
                {isFolder && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#faebe6] text-[#b85333]">
                    <Layers className="w-3 h-3" />
                    <span>{folderFiles?.length || 1} files · Unified bundle</span>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-[#66554b] mt-1">
                <span>{(combinedSize / (1024 * 1024)).toFixed(2)} MB</span>
                <span>•</span>
                <span className="text-[#c05634] font-medium">
                  {pageCount} {pageCount === 1 ? 'page' : 'pages'} estimated
                </span>
                <span>•</span>
                <span className="text-[#8c7b70]">
                  {isFolder ? 'Merged by server' : 'Verified by server'}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-3 text-[#8c7b70] hover:text-red-700 hover:bg-red-50 rounded-2xl transition-colors cursor-pointer flex-shrink-0"
            title="Remove selection"
            aria-label="Remove selected document or folder"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-center gap-2.5 text-xs sm:text-sm text-red-900 bg-red-50 border border-red-200 p-4 rounded-2xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-700" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
