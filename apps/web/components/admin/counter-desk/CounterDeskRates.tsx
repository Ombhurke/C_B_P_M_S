'use client';

import React, { useState } from 'react';
import { CounterDeskContextType } from './types';
import { PaperRateConfig } from '@/lib/types';
import { request } from '@/lib/api';
import { Save, CheckCircle2, AlertCircle, Info, Layers, Tag } from 'lucide-react';

export default function CounterDeskRates({ ctx }: { ctx: CounterDeskContextType }) {
  const { shop, refreshData, token } = ctx;

  const defaultRates: PaperRateConfig = {
    normal: { bw_single: 2, bw_duplex: 3, color_single: 10, color_duplex: 18 },
    bond: { bw_single: 3, bw_duplex: 5, color_single: 12, color_duplex: 22 }
  };

  const initialRates: PaperRateConfig = shop.paper_rates || defaultRates;

  const [supportsBw, setSupportsBw] = useState(shop.supports_bw ?? true);
  const [supportsColor, setSupportsColor] = useState(shop.supports_color ?? true);
  const [supportsDuplex, setSupportsDuplex] = useState(shop.supports_duplex ?? true);
  const [layouts, setLayouts] = useState<number[]>(shop.supported_layouts || [1, 2, 4, 8]);
  const [paperRates, setPaperRates] = useState<PaperRateConfig>(initialRates);

  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleLayout = (val: number) => {
    if (layouts.includes(val)) {
      if (layouts.length === 1) return; // Keep at least one
      setLayouts(layouts.filter(l => l !== val));
    } else {
      setLayouts([...layouts, val].sort((a, b) => a - b));
    }
  };

  const updateRate = (
    paper: 'normal' | 'bond',
    field: 'bw_single' | 'bw_duplex' | 'color_single' | 'color_duplex',
    val: number
  ) => {
    setPaperRates(prev => {
      const current = prev[paper] || { bw_single: 2, bw_duplex: 3, color_single: 10, color_duplex: 18 };
      return {
        ...prev,
        [paper]: {
          ...current,
          [field]: val
        }
      };
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSavedSuccess(false);

    try {
      await request(`/shops/${shop.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supports_bw: supportsBw,
          supports_color: supportsColor,
          supports_duplex: supportsDuplex,
          supported_layouts: layouts,
          paper_rates: paperRates,
          base_rate_bw_in_inr: paperRates.normal?.bw_single ?? 2,
          base_rate_color_in_inr: paperRates.normal?.color_single ?? 10,
          duplex_rate_in_inr: paperRates.normal?.bw_duplex ?? 3
        })
      }, token);

      setSavedSuccess(true);
      await refreshData();
      setTimeout(() => setSavedSuccess(false), 4000);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2dad0]">
        <div>
          <h1 className="font-serif text-3xl text-[#251c17] tracking-tight">Services & Pricing Matrix</h1>
          <p className="text-sm text-[#70645a] mt-1">
            Configure printing capabilities, paper stocks, and per-sheet rates accepted at your counter.
          </p>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
        >
          <Save className="w-4 h-4" />
          <span>{loading ? 'Saving...' : 'Save Rate Matrix'}</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#eef3eb] border border-[#d8e3d3] text-xs font-semibold text-[#3b5232]">
          <CheckCircle2 className="w-4 h-4" />
          <span>Pricing matrix successfully updated. New rates apply immediately to upcoming customer quotes.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Capabilities & N-Up Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Capabilities */}
        <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-[#251c17]">Print Capabilities</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-xl border border-[#f0eae1] hover:bg-[#fcfaf7] cursor-pointer">
              <input
                type="checkbox"
                checked={supportsBw}
                onChange={e => setSupportsBw(e.target.checked)}
                className="rounded text-[#3b5232] w-4 h-4"
              />
              <div>
                <span className="font-semibold text-xs text-[#251c17]">Black & White (Monochrome)</span>
                <p className="text-[11px] text-[#8a7e74]">Enable standard B&W printing service</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-[#f0eae1] hover:bg-[#fcfaf7] cursor-pointer">
              <input
                type="checkbox"
                checked={supportsColor}
                onChange={e => setSupportsColor(e.target.checked)}
                className="rounded text-[#3b5232] w-4 h-4"
              />
              <div>
                <span className="font-semibold text-xs text-[#251c17]">Full Color Printing</span>
                <p className="text-[11px] text-[#8a7e74]">Enable color ink/toner print service</p>
              </div>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-xl border border-[#f0eae1] hover:bg-[#fcfaf7] cursor-pointer">
              <input
                type="checkbox"
                checked={supportsDuplex}
                onChange={e => setSupportsDuplex(e.target.checked)}
                className="rounded text-[#3b5232] w-4 h-4"
              />
              <div>
                <span className="font-semibold text-xs text-[#251c17]">Double-Sided (Duplex)</span>
                <p className="text-[11px] text-[#8a7e74]">Allow front & back printing on single sheet</p>
              </div>
            </label>
          </div>
        </div>

        {/* N-Up Layout Options */}
        <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-[#251c17]">N-Up Layout Options</h2>
          <p className="text-xs text-[#70645a]">Select which multi-page sheet layouts are offered to customers:</p>
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 4, 8].map(n => (
              <label
                key={n}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  layouts.includes(n) ? 'border-[#3b5232] bg-[#f7f9f6]' : 'border-[#e2dad0] bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={layouts.includes(n)}
                  onChange={() => toggleLayout(n)}
                  className="rounded text-[#3b5232] w-4 h-4"
                />
                <div>
                  <span className="font-semibold text-xs text-[#251c17]">{n}-Up Layout</span>
                  <div className="text-[10px] text-[#8a7e74]">{n} page{n > 1 ? 's' : ''} per physical side</div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex items-start gap-2 p-3 rounded-xl bg-[#fbf9f6] border border-[#ede5d8] text-[11px] text-[#70645a]">
            <Info className="w-4 h-4 text-[#ea7c50] shrink-0 mt-0.5" />
            <span>Policy: Multi-page N-Up layouts are grouped into physical sides with no extra fee per sheet.</span>
          </div>
        </div>
      </div>

      {/* Paper Stocks & Rates Matrix */}
      <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm space-y-6">
        <h2 className="font-serif text-xl text-[#251c17]">Paper Stocks & Per-Side Pricing</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Normal Paper Box */}
          <div className="p-5 rounded-2xl border border-[#e2dad0] bg-[#fbf9f6] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ede5d8]">
              <div>
                <span className="font-semibold text-xs uppercase text-[#3b5232]">Standard Stock</span>
                <h3 className="font-serif text-base font-bold text-[#251c17]">Normal Paper (70–75 GSM)</h3>
              </div>
              <span className="text-[11px] font-mono text-[#8a7e74]">Everyday Print</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">B&W Single-Side (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.normal?.bw_single ?? 2}
                  onChange={e => updateRate('normal', 'bw_single', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">B&W Duplex (Both sides) (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.normal?.bw_duplex ?? 3}
                  onChange={e => updateRate('normal', 'bw_duplex', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">Color Single-Side (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.normal?.color_single ?? 10}
                  onChange={e => updateRate('normal', 'color_single', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">Color Duplex (Both sides) (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.normal?.color_duplex ?? 18}
                  onChange={e => updateRate('normal', 'color_duplex', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
            </div>
          </div>

          {/* Bond Paper Box */}
          <div className="p-5 rounded-2xl border border-[#e2dad0] bg-[#fbf9f6] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#ede5d8]">
              <div>
                <span className="font-semibold text-xs uppercase text-[#ea7c50]">Premium Stock</span>
                <h3 className="font-serif text-base font-bold text-[#251c17]">Bond Paper (Executive/Thesis)</h3>
              </div>
              <span className="text-[11px] font-mono text-[#8a7e74]">Heavy Weight</span>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">B&W Single-Side (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.bond?.bw_single ?? 3}
                  onChange={e => updateRate('bond', 'bw_single', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">B&W Duplex (Both sides) (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.bond?.bw_duplex ?? 5}
                  onChange={e => updateRate('bond', 'bw_duplex', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">Color Single-Side (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.bond?.color_single ?? 12}
                  onChange={e => updateRate('bond', 'color_single', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[#70645a] mb-1">Color Duplex (Both sides) (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={paperRates.bond?.color_duplex ?? 22}
                  onChange={e => updateRate('bond', 'color_duplex', parseFloat(e.target.value) || 0)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white font-mono font-bold text-[#251c17]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
