'use client';

import React, { useState } from 'react';
import { Shop } from '@/lib/types';
import { Settings, Save, CheckCircle2, Layers, FileText } from 'lucide-react';

interface RateConfiguratorProps {
  shop: Shop;
  onSave: (updated: Partial<Shop>) => Promise<void>;
}

export default function RateConfigurator({ shop, onSave }: RateConfiguratorProps) {
  // Capability flags
  const [supportsBw, setSupportsBw] = useState(shop.supports_bw ?? true);
  const [supportsColor, setSupportsColor] = useState(shop.supports_color ?? true);
  const [supportsDuplex, setSupportsDuplex] = useState(shop.supports_duplex ?? true);
  const [supportedLayouts, setSupportedLayouts] = useState<number[]>(shop.supported_layouts ?? [1, 2, 4, 8]);

  // Normal paper rates
  const normalRates = shop.paper_rates?.normal;
  const [normalBwSimplex, setNormalBwSimplex] = useState(normalRates?.bw_single ?? shop.base_bw_rate ?? 2.0);
  const [normalBwDuplex, setNormalBwDuplex] = useState(normalRates?.bw_duplex ?? 3.0);
  const [normalColorSimplex, setNormalColorSimplex] = useState(normalRates?.color_single ?? shop.base_color_rate ?? 10.0);

  // Bond paper rates
  const bondRates = shop.paper_rates?.bond;
  const [bondBwSimplex, setBondBwSimplex] = useState(bondRates?.bw_single ?? 3.0);
  const [bondBwDuplex, setBondBwDuplex] = useState(bondRates?.bw_duplex ?? 5.0);
  const [bondColorSimplex, setBondColorSimplex] = useState(bondRates?.color_single ?? 12.0);

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const toggleLayout = (nup: number) => {
    if (supportedLayouts.includes(nup)) {
      if (supportedLayouts.length > 1) {
        setSupportedLayouts(supportedLayouts.filter(l => l !== nup));
      }
    } else {
      setSupportedLayouts([...supportedLayouts, nup].sort((a, b) => a - b));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setSaved(false); setError('');
    try {
      const duplexDiscount = Math.max(0, (normalBwSimplex * 2) - normalBwDuplex);
      await onSave({
        supports_bw: supportsBw,
        supports_color: supportsColor,
        supports_duplex: supportsDuplex,
        supported_layouts: supportedLayouts,
        base_bw_rate: Number(normalBwSimplex),
        base_color_rate: Number(normalColorSimplex),
        duplex_discount: Number(duplexDiscount),
        paper_rates: {
          normal: {
            bw_single: Number(normalBwSimplex),
            bw_duplex: Number(normalBwDuplex),
            color_single: Number(normalColorSimplex),
            color_duplex: Number(normalColorSimplex * 1.8),
          },
          bond: {
            bw_single: Number(bondBwSimplex),
            bw_duplex: Number(bondBwDuplex),
            color_single: Number(bondColorSimplex),
            color_duplex: Number(bondColorSimplex * 1.8),
          }
        }
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) { setError(err instanceof Error ? err.message : 'Rates could not be saved'); }
    finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="glass-panel p-6 rounded-3xl border border-[#f5efe6]/10 space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#f5efe6]/10">
        <div className="flex items-center gap-2 text-[#fbf9f5] font-bold text-base">
          <Settings className="w-5 h-5 text-[#ea7c50]" />
          <span>Shop Capabilities & Pricing Matrix</span>
        </div>
        {saved && (
          <span className="flex items-center gap-1 text-xs text-[#34d399] font-semibold bg-[#34d399]/10 px-3 py-1 rounded-full border border-[#34d399]/25">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved
          </span>
        )}
      </div>

      {/* Capabilities Section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-[#ba9e88] uppercase tracking-wider">
          <Layers className="w-4 h-4 text-[#ea7c50]" />
          <span>Printing Capabilities</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#14100e] border border-[#f5efe6]/10 cursor-pointer text-xs font-semibold text-[#fbf9f5]">
            <input
              type="checkbox"
              checked={supportsBw}
              onChange={e => setSupportsBw(e.target.checked)}
              className="accent-[#ea7c50] w-4 h-4 rounded"
            />
            <span>B&W Printing</span>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#14100e] border border-[#f5efe6]/10 cursor-pointer text-xs font-semibold text-[#fbf9f5]">
            <input
              type="checkbox"
              checked={supportsColor}
              onChange={e => setSupportsColor(e.target.checked)}
              className="accent-[#ea7c50] w-4 h-4 rounded"
            />
            <span>Color Printing</span>
          </label>
          <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#14100e] border border-[#f5efe6]/10 cursor-pointer text-xs font-semibold text-[#fbf9f5]">
            <input
              type="checkbox"
              checked={supportsDuplex}
              onChange={e => setSupportsDuplex(e.target.checked)}
              className="accent-[#ea7c50] w-4 h-4 rounded"
            />
            <span>Both Sides (Duplex)</span>
          </label>
        </div>

        {/* N-Up Selection */}
        <div className="mt-3">
          <label className="text-xs text-[#ba9e88] font-semibold mb-1.5 block">
            Supported Pages-per-Sheet (N-Up, No Extra Charge):
          </label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 4, 8].map(nup => (
              <button
                key={nup}
                type="button"
                onClick={() => toggleLayout(nup)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-colors cursor-pointer border ${
                  supportedLayouts.includes(nup)
                    ? 'bg-[#ea7c50] text-white border-[#ea7c50]'
                    : 'bg-[#14100e] text-neutral-400 border-white/10 hover:border-white/20'
                }`}
              >
                {nup}-up {nup === 1 ? '(1 page)' : `(${nup} pages)`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Normal Paper Pricing */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#ba9e88] uppercase tracking-wider">
          <FileText className="w-4 h-4 text-[#ea7c50]" />
          <span>Standard Paper (70–75 GSM) Rates ({shop.currency})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">B&W 1-Sided (₹)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={normalBwSimplex}
              onChange={e => setNormalBwSimplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">B&W Both Sides (₹/sheet)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={normalBwDuplex}
              onChange={e => setNormalBwDuplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">Color 1-Sided (₹)</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={normalColorSimplex}
              onChange={e => setNormalColorSimplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
        </div>
      </div>

      {/* Bond Paper Pricing */}
      <div className="space-y-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-2 text-xs font-bold text-[#ba9e88] uppercase tracking-wider">
          <FileText className="w-4 h-4 text-[#ea7c50]" />
          <span>Bond Paper Rates ({shop.currency})</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">Bond B&W 1-Sided (₹)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={bondBwSimplex}
              onChange={e => setBondBwSimplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">Bond B&W Both Sides (₹/sheet)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              value={bondBwDuplex}
              onChange={e => setBondBwDuplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
          <div>
            <label className="text-xs text-[#ba9e88] font-semibold mb-1 block">Bond Color 1-Sided (₹)</label>
            <input
              type="number"
              step="0.50"
              min="0"
              value={bondColorSimplex}
              onChange={e => setBondColorSimplex(parseFloat(e.target.value) || 0)}
              className="w-full bg-[#14100e] border border-[#f5efe6]/15 rounded-xl px-3 py-2 text-[#fbf9f5] font-mono text-sm focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
        </div>
      </div>

      {error && <p role="alert" className="text-xs text-[#fca5a5] bg-[#451a1a]/70 border border-[#f87171]/30 p-2.5 rounded-xl">{error}</p>}
      <button
        disabled={busy}
        type="submit"
        className="mt-2 w-full py-3 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-[#ea7c50]/20 transition-all cursor-pointer"
      >
        <Save className="w-4 h-4" />
        <span>Save Capabilities & Pricing</span>
      </button>
    </form>
  );
}
