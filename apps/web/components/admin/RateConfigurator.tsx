'use client';

import React, { useState } from 'react';
import { Shop } from '@/lib/types';
import { Settings, Save, CheckCircle2 } from 'lucide-react';

interface RateConfiguratorProps {
  shop: Shop;
  onSave: (updated: { base_bw_rate: number; base_color_rate: number; duplex_discount: number }) => void;
}

export default function RateConfigurator({ shop, onSave }: RateConfiguratorProps) {
  const [bwRate, setBwRate] = useState(shop.base_bw_rate);
  const [colorRate, setColorRate] = useState(shop.base_color_rate);
  const [duplexDiscount, setDuplexDiscount] = useState(shop.duplex_discount);
  const [saved, setSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      base_bw_rate: Number(bwRate),
      base_color_rate: Number(colorRate),
      duplex_discount: Number(duplexDiscount)
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <Settings className="w-5 h-5 text-sky-400" />
          <span>Regional Pricing Matrix</span>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-slate-400 font-semibold mb-1 block">
            B&W Rate ({shop.currency} / page)
          </label>
          <input
            type="number"
            step="0.25"
            min="0"
            value={bwRate}
            onChange={(e) => setBwRate(parseFloat(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-semibold mb-1 block">
            Color Rate ({shop.currency} / page)
          </label>
          <input
            type="number"
            step="0.50"
            min="0"
            value={colorRate}
            onChange={(e) => setColorRate(parseFloat(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 font-semibold mb-1 block">
            Duplex Discount ({shop.currency} / sheet)
          </label>
          <input
            type="number"
            step="0.10"
            min="0"
            value={duplexDiscount}
            onChange={(e) => setDuplexDiscount(parseFloat(e.target.value))}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <button
        type="submit"
        className="mt-2 w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span>Update Shop Rate Parameters</span>
      </button>
    </form>
  );
}
