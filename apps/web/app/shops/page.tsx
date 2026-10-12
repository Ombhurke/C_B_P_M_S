'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, MapPin, Store, ChevronRight, ArrowRight } from 'lucide-react';
import { fetchShops } from '@/lib/api';
import { Shop } from '@/lib/types';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';

export default function FindAShopPage() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterService, setFilterService] = useState<'all' | 'color' | 'duplex' | 'a3'>('all');

  useEffect(() => {
    fetchShops()
      .then((data) => setShops(data || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredShops = shops.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.address && s.address.toLowerCase().includes(searchTerm.toLowerCase()));
    if (!matchesSearch) return false;
    if (filterService === 'color') return s.printers?.some((p) => p.is_color_supported);
    if (filterService === 'duplex') return s.printers?.some((p) => p.is_duplex_supported);
    if (filterService === 'a3') return s.printers?.some((p) => p.max_paper_size === 'A3');
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="shops" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-10 sm:py-14 space-y-10 sm:space-y-12">
        {/* Page Top Title Row */}
        <div>
          <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-serif text-[#241814] font-normal tracking-tight leading-tight">
            Find your print counter.
          </h1>
          <p className="text-lg sm:text-xl lg:text-[1.35rem] text-[#66554b] mt-2 sm:mt-3 font-normal max-w-2xl leading-relaxed">
            Compare services, choose a shop, and prepare your print.
          </p>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="w-6 h-6 text-[#8c7b70] absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by shop name, campus or area…"
                className="w-full pl-14 pr-6 h-14 sm:h-16 rounded-2xl border border-[#dcd4c8] bg-white text-base sm:text-lg text-[#241814] focus:outline-none focus:border-[#c05634] shadow-xs transition-colors"
              />
            </div>
            <button
              type="button"
              className="h-14 sm:h-16 px-10 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base sm:text-lg font-semibold transition-all shadow-lg shadow-[#c05634]/20 hover:shadow-xl hover:shadow-[#c05634]/30 cursor-pointer"
            >
              Search
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex flex-wrap items-center gap-2.5">
              {(['all', 'color', 'duplex', 'a3'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setFilterService(filter)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer capitalize ${
                    filterService === filter
                      ? 'bg-[#c05634] text-white shadow-xs'
                      : 'border border-[#dcd4c8] text-[#3d2f28] hover:bg-neutral-50 bg-white'
                  }`}
                >
                  {filter === 'all' ? 'All shops' : filter === 'color' ? 'Colour printing' : filter === 'duplex' ? 'Double-sided' : 'A3 printing'}
                </button>
              ))}
            </div>

            <span className="text-sm text-[#8c7b70] font-medium">
              {filteredShops.length} {filteredShops.length === 1 ? 'shop listed' : 'shops listed'}
            </span>
          </div>
        </div>

        {/* Directory Cards Grid or Honest Empty State */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-pulse">
            <div className="h-80 bg-white rounded-3xl border border-[#e6dfd5]" />
            <div className="h-80 bg-white rounded-3xl border border-[#e6dfd5]" />
            <div className="h-80 bg-white rounded-3xl border border-[#e6dfd5]" />
          </div>
        ) : filteredShops.length === 0 ? (
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-12 sm:p-16 text-center shadow-xs space-y-5 max-w-3xl mx-auto">
            <div className="w-20 h-20 rounded-3xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] mx-auto shadow-xs">
              <Store className="w-10 h-10" />
            </div>
            <div className="space-y-2 max-w-xl mx-auto">
              <h2 className="text-2xl sm:text-3xl font-serif font-bold text-[#241814]">
                No participating print shops in this area yet
              </h2>
              <p className="text-base text-[#66554b] leading-relaxed">
                We are currently onboarding partner print counters. When shops register, their counters, capabilities, and rates will appear here. In the meantime, save files in your private library.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/account/documents"
                className="inline-flex items-center gap-2.5 h-13 px-8 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all"
              >
                <span>Upload to private library</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredShops.map((shop) => (
              <div key={shop.id} className="bg-white border border-[#e6dfd5] rounded-3xl p-8 shadow-xs flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="h-36 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#8c7b70]">
                    <Store className="w-12 h-12 text-[#a39484]" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-serif font-bold text-[#241814]">{shop.name}</h3>
                    <p className="text-sm text-[#66554b] flex items-center gap-1.5 mt-1.5">
                      <MapPin className="w-4 h-4 text-[#c05634]" />
                      <span>{shop.address || 'Local print counter'}</span>
                    </p>
                  </div>
                  <div className="text-sm text-[#66554b] space-y-1.5 pt-3 border-t border-[#f4eee6]">
                    <div className="flex justify-between">
                      <span>B&W / page</span>
                      <span className="font-semibold text-[#241814]">₹{shop.base_bw_rate}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Colour / page</span>
                      <span className="font-semibold text-[#241814]">₹{shop.base_color_rate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <Link
                    href={`/shop/${encodeURIComponent(shop.id)}`}
                    className="flex-1 h-12 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold flex items-center justify-center transition-colors shadow-xs"
                  >
                    Select shop
                  </Link>
                  <Link
                    href={`/shop/${encodeURIComponent(shop.id)}`}
                    className="flex-1 h-12 rounded-xl border border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-sm font-semibold flex items-center justify-center transition-colors"
                  >
                    View details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Banner from Option B */}
        <div className="bg-[#f0ebe3] border border-[#e2d9cd] rounded-3xl p-8 sm:p-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 shadow-xs">
          <div className="space-y-1.5 max-w-xl">
            <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#241814]">
              Your document. Your choice of counter.
            </h3>
            <p className="text-base text-[#66554b] leading-relaxed">
              Review printing options, colour selection, and the final price before submitting.
            </p>
          </div>

          <Link
            href="/help"
            className="h-13 px-7 rounded-2xl border-2 border-[#c05634] text-[#c05634] hover:bg-[#c05634]/10 text-base font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
          >
            <span>How printing works</span>
            <ChevronRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    </div>
  );
}
