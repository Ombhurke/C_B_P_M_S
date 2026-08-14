'use client';

import React from 'react';
import { ListOrdered, Clock, Zap, CheckCircle2 } from 'lucide-react';

interface QueueItem {
  id: string;
  file_name: string;
  page_count: number;
  copy_count: number;
  is_color: boolean;
  total_cost: number;
  release_token: string;
  job_status: string;
  created_at: string;
}

interface LiveQueueMonitorProps {
  queue: QueueItem[];
  onReleaseManual: (token: string) => void;
}

export default function LiveQueueMonitor({ queue, onReleaseManual }: LiveQueueMonitorProps) {
  return (
    <div className="glass-panel p-6 rounded-3xl border border-slate-800">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2 text-white font-bold text-base">
          <ListOrdered className="w-5 h-5 text-amber-400" />
          <span>Real-Time Paid Print Queue</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span>{queue.length} Active Jobs</span>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-10 text-slate-500 text-xs">
          No pending print jobs in queue. Customer jobs will appear here live upon payment.
        </div>
      ) : (
        <div className="space-y-2.5">
          {queue.map((item) => (
            <div
              key={item.id}
              className="bg-slate-900/90 border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-sky-400 bg-sky-950 px-2 py-0.5 rounded border border-sky-800">
                    PIN: {item.release_token}
                  </span>
                  <span className="font-semibold text-white text-sm truncate">{item.file_name}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                  <span>{item.page_count} Pgs</span>
                  <span>•</span>
                  <span>{item.copy_count} Copy</span>
                  <span>•</span>
                  <span className={item.is_color ? 'text-indigo-400' : 'text-slate-300'}>
                    {item.is_color ? 'Color' : 'B&W'}
                  </span>
                  <span>•</span>
                  <span className="font-bold text-white font-mono">₹{item.total_cost.toFixed(2)}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onReleaseManual(item.release_token)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 flex-shrink-0 cursor-pointer"
              >
                <Zap className="w-3.5 h-3.5 fill-current" />
                <span>Release</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
