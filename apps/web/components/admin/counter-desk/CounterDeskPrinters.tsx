'use client';

import React, { useState } from 'react';
import { CounterDeskContextType } from './types';
import { Printer as PrinterIcon, Plus, Laptop, Wifi, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function CounterDeskPrinters({ ctx }: { ctx: CounterDeskContextType }) {
  const { shop, stations, refreshData, token } = ctx;
  const [showAddPrinter, setShowAddPrinter] = useState(false);
  const [showAddStation, setShowAddStation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Printer Form State
  const [deviceName, setDeviceName] = useState('');
  const [maxPaperSize, setMaxPaperSize] = useState('A4');
  const [isColor, setIsColor] = useState(true);
  const [isDuplex, setIsDuplex] = useState(true);

  // Station Form State
  const [stationName, setStationName] = useState('');
  const [stationLocation, setStationLocation] = useState('Front Desk');

  const handleCreatePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/shops/${shop.id}/printers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          device_name: deviceName,
          max_paper_size: maxPaperSize,
          is_color_supported: isColor,
          is_duplex_supported: isDuplex
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create printer');
      }
      setShowAddPrinter(false);
      setDeviceName('');
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationName) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/v1/shops/${shop.id}/stations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: stationName,
          location: stationLocation
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to pair station');
      }
      setShowAddStation(false);
      setStationName('');
      await refreshData();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2dad0]">
        <div>
          <h1 className="font-serif text-3xl text-[#251c17] tracking-tight">Printers & Print Stations</h1>
          <p className="text-sm text-[#70645a] mt-1">Manage physical hardware devices and paired Windows desktop stations.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddPrinter(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Register Printer</span>
          </button>
          <button
            onClick={() => setShowAddStation(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#3b5232] hover:bg-[#2d4026] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
          >
            <Laptop className="w-4 h-4" />
            <span>Pair Station</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* Printer Fleet Cards */}
      <div className="space-y-4">
        <h2 className="font-serif text-xl text-[#251c17]">Registered Print Devices ({shop.printers?.length ?? 0})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shop.printers?.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-[#e2dad0] p-5 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f5f1e9] border border-[#e2dad0] flex items-center justify-center text-[#70645a]">
                    <PrinterIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#251c17]">{p.device_name}</h3>
                    <div className="text-[11px] text-[#8a7e74] font-mono">{p.id.slice(0, 8)}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                  p.status === 'online' ? 'bg-[#eef3eb] text-[#2f5a25]' : 'bg-[#fef2f2] text-[#b91c1c]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-[#34a853]' : 'bg-[#dc2626]'}`} />
                  {p.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#f0eae1]">
                <div>
                  <span className="text-[#8a7e74]">Color Mode:</span>
                  <div className="font-medium text-[#251c17]">{p.is_color_supported ? 'Color & B&W' : 'B&W Only'}</div>
                </div>
                <div>
                  <span className="text-[#8a7e74]">Duplex:</span>
                  <div className="font-medium text-[#251c17]">{p.is_duplex_supported ? 'Supported' : 'Simplex'}</div>
                </div>
                <div>
                  <span className="text-[#8a7e74]">Paper Size:</span>
                  <div className="font-medium text-[#251c17]">{p.max_paper_size}</div>
                </div>
                <div>
                  <span className="text-[#8a7e74]">Status:</span>
                  <div className="font-medium text-[#251c17]">Verified Driver</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Paired Windows Stations */}
      <div className="bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
          <div>
            <h2 className="font-serif text-lg text-[#251c17]">Windows Print Stations ({stations.length})</h2>
            <p className="text-xs text-[#70645a] mt-0.5">Desktop agent software instances communicating with your store's spooler.</p>
          </div>
          <button onClick={() => refreshData()} className="text-xs text-[#70645a] hover:text-[#251c17] flex items-center gap-1 cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync</span>
          </button>
        </div>

        {!stations.length ? (
          <div className="text-center py-8 text-xs text-[#8a7e74]">
            No desktop stations paired yet. Launch Print Station on your Windows PC and connect using staff credentials.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#f0eae1] text-[#91857a] font-medium text-[11px]">
                  <th className="pb-2.5 font-medium">Station Name</th>
                  <th className="pb-2.5 font-medium">Location</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium">Assigned Printer</th>
                  <th className="pb-2.5 text-right font-medium">Last Sync</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7f3ed]">
                {stations.map(st => (
                  <tr key={st.id} className="hover:bg-[#fcfaf7]">
                    <td className="py-3 font-semibold text-[#251c17] flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-[#70645a]" />
                      <span>{st.name}</span>
                    </td>
                    <td className="py-3 text-[#52473f]">{st.location}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        st.status === 'online' ? 'bg-[#eef3eb] text-[#2f5a25]' : 'bg-[#fef2f2] text-[#b91c1c]'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${st.status === 'online' ? 'bg-[#34a853]' : 'bg-[#dc2626]'}`} />
                        {st.status}
                      </span>
                    </td>
                    <td className="py-3 text-[#70645a] font-mono text-[11px]">
                      {st.assigned_printer_id || 'Default Spooler'}
                    </td>
                    <td className="py-3 text-right font-mono text-[11px] text-[#91857a]">
                      {st.last_sync ? new Date(st.last_sync).toLocaleTimeString() : 'Recent'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Printer Modal */}
      {showAddPrinter && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreatePrinter} className="bg-white rounded-2xl border border-[#e2dad0] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-serif text-xl font-bold text-[#251c17]">Register Printer</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Device Name / Driver</label>
                <input
                  type="text"
                  placeholder="e.g. HP Smart Tank 580-590 series"
                  value={deviceName}
                  onChange={e => setDeviceName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Max Paper Size</label>
                <select
                  value={maxPaperSize}
                  onChange={e => setMaxPaperSize(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white"
                >
                  <option value="A4">A4 (Standard 210 x 297 mm)</option>
                  <option value="Letter">Letter (8.5 x 11 in)</option>
                  <option value="Legal">Legal (8.5 x 14 in)</option>
                  <option value="A3">A3 (Large Format)</option>
                </select>
              </div>
              <div className="flex items-center gap-4 pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#251c17]">
                  <input
                    type="checkbox"
                    checked={isColor}
                    onChange={e => setIsColor(e.target.checked)}
                    className="rounded text-[#ea7c50]"
                  />
                  <span>Supports Color</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer font-medium text-[#251c17]">
                  <input
                    type="checkbox"
                    checked={isDuplex}
                    onChange={e => setIsDuplex(e.target.checked)}
                    className="rounded text-[#ea7c50]"
                  />
                  <span>Supports Duplex</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddPrinter(false)}
                className="px-4 py-2 rounded-xl border border-[#e2dad0] text-xs font-semibold text-[#70645a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#ea7c50] text-white text-xs font-semibold hover:bg-[#d75d31] cursor-pointer"
              >
                {loading ? 'Adding...' : 'Save Printer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Station Modal */}
      {showAddStation && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <form onSubmit={handleCreateStation} className="bg-white rounded-2xl border border-[#e2dad0] p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-serif text-xl font-bold text-[#251c17]">Pair Desktop Station</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Station Identifier / Computer Name</label>
                <input
                  type="text"
                  placeholder="e.g. Counter-Desk-01"
                  value={stationName}
                  onChange={e => setStationName(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
                />
              </div>
              <div>
                <label className="block font-semibold text-[#251c17] mb-1">Counter Location</label>
                <input
                  type="text"
                  placeholder="e.g. Front Cashier Desk"
                  value={stationLocation}
                  onChange={e => setStationLocation(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setShowAddStation(false)}
                className="px-4 py-2 rounded-xl border border-[#e2dad0] text-xs font-semibold text-[#70645a] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#3b5232] text-white text-xs font-semibold hover:bg-[#2d4026] cursor-pointer"
              >
                {loading ? 'Pairing...' : 'Confirm Pairing'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
