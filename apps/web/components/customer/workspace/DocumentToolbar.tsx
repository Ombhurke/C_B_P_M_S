'use client';

import React from 'react';
import { Search, LayoutGrid, List } from 'lucide-react';

interface DocumentToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  filterType: 'all' | 'pdf' | 'images';
  onFilterTypeChange: (value: 'all' | 'pdf' | 'images') => void;
  sortBy: 'recent' | 'oldest' | 'name_asc' | 'size_desc';
  onSortByChange: (value: 'recent' | 'oldest' | 'name_asc' | 'size_desc') => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (value: 'grid' | 'list') => void;
}

export default function DocumentToolbar({
  search,
  onSearchChange,
  filterType,
  onFilterTypeChange,
  sortBy,
  onSortByChange,
  viewMode,
  onViewModeChange,
}: DocumentToolbarProps) {
  return (
    <div className="bg-[#ffffff] border border-[#e6dfd5] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
      {/* Search Input & Format Filter Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
        <div className="relative w-full sm:w-96">
          <Search className="w-5 h-5 text-[#8c7b70] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search your documents…"
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#dcd4c8] bg-[#fdfbf9] text-sm sm:text-base text-[#241814] focus:outline-none focus:border-[#c05634] transition-colors"
          />
        </div>

        <div className="flex items-center gap-2.5">
          {(['all', 'pdf', 'images'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onFilterTypeChange(type)}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer capitalize ${
                filterType === type
                  ? 'bg-[#c05634] text-white shadow-xs'
                  : 'border border-[#dcd4c8] text-[#3d2f28] hover:bg-neutral-50'
              }`}
            >
              {type === 'all' ? 'All files' : type === 'pdf' ? 'PDF' : 'Images'}
            </button>
          ))}
        </div>
      </div>

      {/* Sort Select & Grid/List View Mode */}
      <div className="flex items-center justify-between sm:justify-end gap-4">
        <select
          value={sortBy}
          onChange={(e) => onSortByChange(e.target.value as any)}
          className="px-5 py-2.5 rounded-2xl border border-[#dcd4c8] bg-[#fdfbf9] text-sm font-medium text-[#241814] focus:outline-none focus:border-[#c05634] transition-colors cursor-pointer"
        >
          <option value="recent">Recently added</option>
          <option value="oldest">Oldest first</option>
          <option value="name_asc">Alphabetical (A-Z)</option>
          <option value="size_desc">File size (largest)</option>
        </select>

        <div className="flex items-center border border-[#dcd4c8] rounded-2xl overflow-hidden bg-[#fdfbf9]">
          <button
            type="button"
            onClick={() => onViewModeChange('grid')}
            className={`p-2.5 transition-colors cursor-pointer ${
              viewMode === 'grid' ? 'bg-[#c05634] text-white' : 'text-[#8c7b70] hover:text-[#241814]'
            }`}
            aria-label="Grid view"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={`p-2.5 transition-colors cursor-pointer ${
              viewMode === 'list' ? 'bg-[#c05634] text-white' : 'text-[#8c7b70] hover:text-[#241814]'
            }`}
            aria-label="List view"
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
