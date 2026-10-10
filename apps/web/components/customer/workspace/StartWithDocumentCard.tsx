'use client';

import React from 'react';
import Link from 'next/link';
import { Upload, Folder } from 'lucide-react';

interface StartWithDocumentCardProps {
  onUploadClick: () => void;
}

export default function StartWithDocumentCard({ onUploadClick }: StartWithDocumentCardProps) {
  return (
    <div className="bg-[#ffffff] border border-[#e6dfd5] rounded-3xl p-8 sm:p-10 lg:p-12 shadow-xs hover:shadow-md transition-shadow flex flex-col md:flex-row items-center gap-8 lg:gap-12 h-full">
      {/* Decorative Paper Sketch Artwork Plate (Matching Option B) */}
      <div className="w-48 h-48 sm:w-56 sm:h-56 lg:w-60 lg:h-60 flex-shrink-0 flex items-center justify-center relative bg-[#faf6f0] rounded-full border border-[#efe7dd] p-6 shadow-inner">
        {/* Sunburst Accent Marks (Option B linework) */}
        <div className="absolute top-4 right-8 w-1 h-3.5 bg-[#c05634]/60 rounded-full rotate-45 transform" />
        <div className="absolute top-8 right-4 w-1 h-3.5 bg-[#c05634]/60 rounded-full rotate-12 transform" />
        <div className="absolute bottom-6 left-6 w-1 h-3 bg-[#a39484]/40 rounded-full -rotate-45 transform" />

        {/* Background Paper Sheet */}
        <div className="absolute w-28 h-38 sm:w-32 sm:h-44 bg-[#f4eee6] border border-[#ded5c7] rounded-xl shadow-md -rotate-6 transform transition-transform group-hover:-rotate-8" />

        {/* Foreground Paper Sheet with Sketch Linework */}
        <div className="absolute w-28 h-38 sm:w-32 sm:h-44 bg-[#ffffff] border border-[#d6cbba] rounded-xl shadow-xl rotate-3 transform p-3.5 flex flex-col justify-between">
          <div className="space-y-2 opacity-70">
            <div className="w-16 h-2 bg-[#a39484] rounded" />
            <div className="w-20 h-1.5 bg-[#d4c8bb] rounded" />
            <div className="w-18 h-1.5 bg-[#d4c8bb] rounded" />
            <div className="w-14 h-1.5 bg-[#d4c8bb] rounded" />
            <div className="w-10 h-1.5 bg-[#d4c8bb] rounded" />
          </div>

          {/* Placeholder sketch diagram */}
          <div className="w-full h-12 bg-[#faf6f0] rounded-lg flex items-center justify-center opacity-80 border border-[#e8dfd3]">
            <div className="w-6 h-6 rounded-full border-2 border-[#a39484]/70 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-[#c05634]" />
            </div>
          </div>
        </div>
      </div>

      {/* Copy & Actions */}
      <div className="flex-1 text-center md:text-left space-y-5">
        <div>
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-wider text-[#c05634] inline-block mb-1">
            Private Customer Workspace
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-[2.65rem] font-serif text-[#241814] font-bold tracking-tight leading-tight">
            Start with a document
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-[#66554b] mt-2.5 leading-relaxed max-w-xl">
            Upload a new file to save in your private cloud, or choose one from your library for instant repeat printing.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2">
          <button
            type="button"
            onClick={onUploadClick}
            className="h-13 sm:h-14 px-8 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base sm:text-lg font-semibold flex items-center gap-3 shadow-lg shadow-[#c05634]/25 hover:shadow-xl hover:shadow-[#c05634]/30 transition-all cursor-pointer"
          >
            <Upload className="w-5 h-5" />
            <span>Upload file</span>
          </button>

          <Link
            href="/account/documents"
            className="h-13 sm:h-14 px-8 rounded-2xl border-2 border-[#c05634] text-[#c05634] hover:bg-[#c05634]/10 text-base sm:text-lg font-semibold flex items-center gap-3 transition-colors"
          >
            <Folder className="w-5 h-5" />
            <span>Open library</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
