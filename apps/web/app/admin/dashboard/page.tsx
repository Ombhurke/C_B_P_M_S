'use client';

import React, { useState, useEffect } from 'react';
import { Shop } from '@/lib/types';
import { fetchShop } from '@/lib/api';
import RateConfigurator from '@/components/admin/RateConfigurator';
import PrinterManager from '@/components/admin/PrinterManager';
import LiveQueueMonitor from '@/components/admin/LiveQueueMonitor';
import { LayoutDashboard, ArrowLeft, BarChart3, Users, Clock, Shield } from 'lucide-react';
import Link from 'next/link';

export default function AdminDashboardPage() {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);

  // Mock live queue items for dashboard demo
  const [queue, setQueue] = useState([
    {
      id: 'job-98a1',
      file_name: 'CS301_Assignment_Final.pdf',
      page_count: 8,
      copy_count: 1,
      is_color: false,
      total_cost: 16.0,
      release_token: '4821',
      job_status: 'queued',
      created_at: new Date().toISOString()
    },
    {
      id: 'job-98a2',
      file_name: 'Project_Brochure_Flyer.png',
      page_count: 2,
      copy_count: 2,
      is_color: true,
      total_cost: 40.0,
      release_token: '7193',
      job_status: 'queued',
      created_at: new Date().toISOString()
    }
  ]);

  useEffect(() => {
    fetchShop('shop-demo-1').then((res) => {
      setShop(res);
      setLoading(false);
    });
  }, []);

  const handleUpdateRates = (rates: { base_bw_rate: number; base_color_rate: number; duplex_discount: number }) => {
    if (!shop) return;
    setShop({
      ...shop,
      ...rates
    });
  };

  const handleReleaseJob = (token: string) => {
    setQueue((prev) => prev.filter((item) => item.release_token !== token));
    alert(`Print Job with Token ${token} successfully spooled and shredded!`);
  };

  if (loading || !shop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-20">
      {/* Header */}
      <header className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Exit to Home</span>
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-slate-400 font-mono">Operator Console Active</span>
        </div>
      </header>

      {/* Title & Quick Stats */}
      <div className="mb-8">
        <div className="text-xs uppercase font-bold text-sky-400 tracking-wider">Cloud Management Console</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
          {shop.name}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor incoming walk-in print queues, hardware devices, and manage per-page pricing.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Today's Total Jobs</span>
            <BarChart3 className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">148</div>
          <div className="text-[11px] text-emerald-400 font-medium mt-1">↑ 18% vs yesterday</div>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>Queue Average Wait</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">&lt; 45 sec</div>
          <div className="text-[11px] text-slate-400 mt-1">Direct USB scan release</div>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>PII Shredder Rate</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-black text-white mt-2 font-mono">100%</div>
          <div className="text-[11px] text-emerald-400 mt-1">0 bytes retained</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="space-y-6">
        <LiveQueueMonitor queue={queue} onReleaseManual={handleReleaseJob} />
        <RateConfigurator shop={shop} onSave={handleUpdateRates} />
        <PrinterManager printers={shop.printers} />
      </div>
    </div>
  );
}
