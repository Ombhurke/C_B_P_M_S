'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shop, QueueItem, Summary, ActivityEvent } from '@/lib/types';
import { CounterDeskTab, Station, TeamMember, CounterDeskContextType } from './types';
import CounterDeskOverview from './CounterDeskOverview';
import CounterDeskQueue from './CounterDeskQueue';
import CounterDeskJobDetails from './CounterDeskJobDetails';
import CounterDeskPrinters from './CounterDeskPrinters';
import CounterDeskRates from './CounterDeskRates';
import CounterDeskTeam from './CounterDeskTeam';
import {
  LayoutDashboard,
  FileText,
  Printer,
  Sliders,
  Users,
  RefreshCw,
  LogOut,
  Store,
  CheckCircle2
} from 'lucide-react';

interface ShellProps {
  initialShop: Shop;
  initialQueue: QueueItem[];
  initialSummary: Summary | null;
  initialActivity: ActivityEvent[];
  token: string;
  onLogout: () => void;
}

export default function CounterDeskShell({
  initialShop,
  initialQueue,
  initialSummary,
  initialActivity,
  token,
  onLogout
}: ShellProps) {
  const [shop, setShop] = useState<Shop>(initialShop);
  const [queue, setQueue] = useState<QueueItem[]>(initialQueue);
  const [summary, setSummary] = useState<Summary | null>(initialSummary);
  const [activity, setActivity] = useState<ActivityEvent[]>(initialActivity);
  const [stations, setStations] = useState<Station[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([
    {
      username: 'ombhurke101@gmail.com',
      shop_id: initialShop.id,
      role: 'admin',
      active: true
    }
  ]);

  const [activeTab, setActiveTab] = useState<CounterDeskTab>('overview');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [viewingJobDetail, setViewingJobDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshData = useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Fetch Shop & Queue
      const [shopRes, queueRes, stationsRes, teamRes] = await Promise.all([
        fetch(`/api/v1/shops/${shop.id}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`/api/v1/shops/${shop.id}/queue`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`/api/v1/shops/${shop.id}/stations`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
        fetch(`/api/v1/shops/${shop.id}/team`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
      ]);

      if (shopRes && shopRes.ok) {
        const s = await shopRes.json();
        setShop(s);
      }
      if (queueRes && queueRes.ok) {
        const q = await queueRes.json();
        setQueue(q);
      }
      if (stationsRes && stationsRes.ok) {
        const st = await stationsRes.json();
        setStations(st);
      }
      if (teamRes && teamRes.ok) {
        const tm = await teamRes.json();
        setTeam(tm);
      }
    } catch {
      // Keep existing on network flicker
    } finally {
      setRefreshing(false);
    }
  }, [shop.id, token]);

  // Periodic polling every 12 seconds
  useEffect(() => {
    const interval = setInterval(refreshData, 12000);
    return () => clearInterval(interval);
  }, [refreshData]);

  const readyJobsCount = queue.filter(j => j.job_status === 'queued' || j.job_status === 'staged').length;

  const contextValue: CounterDeskContextType = {
    shop,
    queue,
    summary,
    activity,
    stations,
    team,
    activeTab,
    setActiveTab,
    selectedJobId,
    setSelectedJobId,
    viewingJobDetail,
    setViewingJobDetail,
    refreshData,
    token
  };

  const navItems = [
    { id: 'overview' as CounterDeskTab, label: 'Overview', icon: LayoutDashboard },
    { id: 'queue' as CounterDeskTab, label: 'Print Queue', icon: FileText, badge: readyJobsCount },
    { id: 'printers' as CounterDeskTab, label: 'Printers & Stations', icon: Printer, badge: shop.printers?.length },
    { id: 'rates' as CounterDeskTab, label: 'Services & Rates', icon: Sliders },
    { id: 'team' as CounterDeskTab, label: 'Staff & Store', icon: Users, badge: team.length }
  ];

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-[#251c17] flex font-sans antialiased selection:bg-[#f4dcd2]">
      {/* 232px Sidebar */}
      <aside className="w-[232px] shrink-0 bg-[#f5f0e8] border-r border-[#e2dad0] flex flex-col justify-between p-4 min-h-screen select-none">
        <div className="space-y-6">
          {/* Shop Header */}
          <div className="px-2 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#3b5232] text-white flex items-center justify-center font-serif font-bold text-sm shadow-xs">
                {shop.name.charAt(0)}
              </div>
              <div>
                <h2 className="font-serif font-bold text-sm text-[#251c17] truncate leading-tight" title={shop.name}>
                  {shop.name}
                </h2>
                <div className="text-[11px] text-[#70645a] font-medium">Counter Desk</div>
              </div>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = activeTab === item.id && !viewingJobDetail;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setViewingJobDetail(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#3b5232] text-white shadow-xs'
                      : 'text-[#52473f] hover:bg-[#eae3d5]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isActive ? 'bg-[#2d4026] text-white' : 'bg-[#e5dec5] text-[#52473f]'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Profile & Logout */}
        <div className="pt-4 border-t border-[#e5dec5] space-y-3 px-2">
          <div className="text-[11px]">
            <div className="font-semibold text-[#251c17] truncate">ombhurke101@gmail.com</div>
            <div className="text-[#8a7e74]">Shop Administrator</div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-[#b91c1c] hover:bg-[#fdeded] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Workspace (fluid minmax(0, 1fr)) */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header (~88px) */}
        <header className="h-[76px] px-8 bg-white border-b border-[#e2dad0] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-[#34a853]" />
            <span className="text-xs font-semibold text-[#251c17]">{shop.name}</span>
            <span className="text-[#d8d0c5]">|</span>
            <span className="text-xs text-[#70645a]">Ready for walkup releases</span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => refreshData()}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-[#e2dad0] bg-[#fbf9f6] hover:bg-[#f5f1e9] text-xs font-semibold text-[#52473f] transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#ea7c50]' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>
          </div>
        </header>

        {/* Workspace Body */}
        <main className="flex-1 p-8 overflow-y-auto">
          {viewingJobDetail ? (
            <CounterDeskJobDetails ctx={contextValue} />
          ) : (
            <>
              {activeTab === 'overview' && <CounterDeskOverview ctx={contextValue} />}
              {activeTab === 'queue' && <CounterDeskQueue ctx={contextValue} />}
              {activeTab === 'printers' && <CounterDeskPrinters ctx={contextValue} />}
              {activeTab === 'rates' && <CounterDeskRates ctx={contextValue} />}
              {activeTab === 'team' && <CounterDeskTeam ctx={contextValue} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
