'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ActivityEvent, ApiError, login, LoginSession, QueueItem, request, Summary } from '@/lib/api';
import { Shop } from '@/lib/types';
import RateConfigurator from '@/components/admin/RateConfigurator';
import PrinterManager from '@/components/admin/PrinterManager';
import LiveQueueMonitor from '@/components/admin/LiveQueueMonitor';
import CounterDeskShell from '@/components/admin/counter-desk/CounterDeskShell';
import { ArrowLeft, Printer, Shield, Activity, RefreshCw } from 'lucide-react';

export default function AdminDashboardPage() {
  const [session, setSession] = useState<LoginSession | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shop, setShop] = useState<Shop | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [live, setLive] = useState(false);
  const [updated, setUpdated] = useState('');

  useEffect(() => {
    if (!session) return;
    let stopped = false, refreshing = false;
    const shopId = encodeURIComponent(session.user.shop_id);
    const refresh = async () => {
      if (refreshing || stopped) return;
      refreshing = true;
      try {
        const [profile, jobs, stats, events] = await Promise.all([
          request<Shop>(`/shops/${shopId}`, {}, session.access_token),
          request<QueueItem[]>(`/jobs/queue/${shopId}`, {}, session.access_token),
          request<Summary>(`/jobs/summary/${shopId}`, {}, session.access_token),
          request<ActivityEvent[]>(`/shops/${shopId}/activity`, {}, session.access_token)
        ]);
        if (!stopped) {
          setShop(profile); setQueue(jobs); setSummary(stats); setActivity(events);
          setUpdated(new Date().toLocaleTimeString()); setError(''); setLive(true);
        }
      } catch (err) {
        if (!stopped) {
          setError(err instanceof Error ? err.message : 'Could not refresh dashboard'); setLive(false);
          if (err instanceof ApiError && err.status === 401) setSession(null);
        }
      } finally { refreshing = false; }
    };
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [session]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      setSession(await login(username, password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally { setBusy(false); }
  };

  const signOut = async () => {
    if (!session) return;
    try {
      await request('/auth/logout', { method: 'POST' }, session.access_token);
      setSession(null); setShop(null); setQueue([]); setSummary(null); setError('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Logout failed; please retry'); }
  };

  // Signed Out: Full Desktop Login Station
  if (!session) {
    return (
      <div className="desktop-workspace min-h-[calc(100vh-80px)] flex flex-col justify-center text-[#fbf9f5]">
        <div className="mb-8">
          <Link href="/" className="text-xs sm:text-sm text-neutral-300 hover:text-white inline-flex items-center gap-2 transition-colors group">
            <ArrowLeft className="w-4 h-4 text-[#ea7c50] group-hover:-translate-x-1 transition-transform" />
            <span>Return to Home</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <div className="lg:col-span-7 space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#ea7c50]/15 border border-[#ea7c50]/30 text-xs font-bold uppercase tracking-wider text-[#ea7c50]">
              <Printer className="w-4 h-4" />
              <span>Operator Terminal Access</span>
            </div>
            <h1 className="text-3xl lg:text-5xl font-black text-[#fbf9f5] tracking-tight">
              Authorized Counter Station Console
            </h1>
            <p className="text-base text-neutral-200 leading-relaxed font-normal">
              Sign in with your store operator credentials to monitor the real-time print queue, dispatch barcode scanner jobs, manage connected thermal & laser printers, and configure per-page rates.
            </p>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-xs text-neutral-300">
              Access is restricted to staff accounts provisioned for your shop. Customer Google accounts cannot access this console.
            </div>
          </div>

          <div className="lg:col-span-5">
            <form onSubmit={signIn} className="glass-panel p-8 sm:p-10 rounded-3xl space-y-5 border border-white/10 shadow-2xl">
              <h2 className="text-2xl font-bold text-[#fbf9f5]">Console Sign In</h2>
              <label className="block text-xs text-neutral-300">
                Username
                <input required autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} className="w-full bg-[#14100e] border border-white/15 text-[#fbf9f5] p-3 rounded-xl mt-1 text-sm focus:outline-none focus:border-[#ea7c50] transition-colors" />
              </label>
              <label className="block text-xs text-neutral-300">
                Password
                <input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-[#14100e] border border-white/15 text-[#fbf9f5] p-3 rounded-xl mt-1 text-sm focus:outline-none focus:border-[#ea7c50] transition-colors" />
              </label>
              {error && <p role="alert" className="text-xs text-[#fca5a5] bg-[#451a1a]/70 border border-[#f87171]/30 p-3 rounded-xl">{error}</p>}
              <button disabled={busy} className="bg-[#ea7c50] hover:bg-[#d75d31] text-white p-3.5 rounded-xl w-full font-bold text-sm shadow-md shadow-[#ea7c50]/20 disabled:opacity-50 transition-all cursor-pointer">
                {busy ? 'Authenticating…' : 'Sign in to Console'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Signed In: Counter Desk Operator Portal (matching OPERATOR_STATION_DESIGNS.md)
  if (shop) {
    return (
      <CounterDeskShell
        initialShop={shop}
        initialQueue={queue}
        initialSummary={summary}
        initialActivity={activity}
        token={session.access_token}
        onLogout={signOut}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] flex items-center justify-center p-8">
      <div className="flex items-center gap-3 text-sm text-[#70645a]">
        <RefreshCw className="w-5 h-5 animate-spin text-[#ea7c50]" />
        <span>Loading Counter Desk workspace for {session.user.shop_id}…</span>
      </div>
    </div>
  );
}
