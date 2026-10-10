'use client';

import React from 'react';
import { CounterDeskContextType } from './types';
import { FileText, Printer, AlertTriangle, CheckCircle2, ArrowRight, Eye, MoreHorizontal, Layers } from 'lucide-react';

export default function CounterDeskOverview({ ctx }: { ctx: CounterDeskContextType }) {
  const { shop, queue, summary, activity, setActiveTab, setSelectedJobId, setViewingJobDetail } = ctx;

  const readyCount = queue.filter(j => j.job_status === 'queued' || j.job_status === 'staged').length;
  const printingCount = queue.filter(j => j.job_status === 'processing').length;
  const attentionCount = queue.filter(j => j.job_status === 'failed' || Boolean(j.cleanup_pending)).length;
  const completedToday = summary?.completed_jobs ?? 0;

  const handleOpenJob = (jobId: string) => {
    setSelectedJobId(jobId);
    setViewingJobDetail(true);
    setActiveTab('queue');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Status Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-6 py-3.5 rounded-2xl bg-[#eef3eb] border border-[#d8e3d3] text-xs text-[#3b5232]">
        <div className="flex items-center gap-2.5 font-semibold">
          <span className="w-2.5 h-2.5 rounded-full bg-[#34a853] animate-pulse" />
          <span>Shop is active</span>
          <span className="text-[#9cb594]">|</span>
          <span className="font-normal text-[#48633f]">Accepting print jobs for {shop.name}</span>
        </div>
        <div className="font-mono text-[11px] text-[#5b7552]">
          Currency: {shop.currency} · Auto-refresh active
        </div>
      </div>

      {/* Main Title & CTA */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl text-[#251c17] tracking-tight">Your counter, at a glance</h1>
          <p className="text-sm text-[#70645a] mt-1.5">Live status of your print queue, registered printers, and recent operator audit activity.</p>
        </div>
        <button
          onClick={() => setActiveTab('queue')}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
        >
          <FileText className="w-4 h-4" />
          <span>View full queue</span>
        </button>
      </div>

      {/* 4 Workload Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-[#e2dad0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#eef3eb] border border-[#d8e3d3] flex items-center justify-center text-[#3b5232]">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#70645a]">Ready in queue</div>
            <div className="text-2xl font-serif font-bold text-[#251c17]">{readyCount}</div>
            <div className="text-[11px] text-[#91857a]">Waiting for pickup</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2dad0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fff2eb] border border-[#f5d5c4] flex items-center justify-center text-[#c85a32]">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#70645a]">Printing now</div>
            <div className="text-2xl font-serif font-bold text-[#251c17]">{printingCount}</div>
            <div className="text-[11px] text-[#91857a]">Active on spooler</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2dad0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#fef7ee] border border-[#fae2c5] flex items-center justify-center text-[#b45309]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#70645a]">Needs attention</div>
            <div className="text-2xl font-serif font-bold text-[#251c17]">{attentionCount}</div>
            <div className="text-[11px] text-[#91857a]">Failed / hold</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-[#e2dad0] shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#f0fdf4] border border-[#bbf7d0] flex items-center justify-center text-[#15803d]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-[#70645a]">Completed today</div>
            <div className="text-2xl font-serif font-bold text-[#251c17]">{completedToday}</div>
            <div className="text-[11px] text-[#91857a]">Successfully printed</div>
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Queue & Printers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Compact Queue Table */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
            <h2 className="font-serif text-lg text-[#251c17]">Live print queue ({queue.length} jobs)</h2>
            <button
              onClick={() => setActiveTab('queue')}
              className="text-xs font-semibold text-[#ea7c50] hover:text-[#d75d31] flex items-center gap-1 cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {!queue.length ? (
            <div className="text-center py-10 text-xs text-[#8a7e74]">
              No active jobs in queue. Incoming customer orders will appear here automatically.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#f0eae1] text-[#91857a] font-medium text-[11px]">
                    <th className="pb-2.5 font-medium">Job Ref</th>
                    <th className="pb-2.5 font-medium">Configuration</th>
                    <th className="pb-2.5 font-medium">Status</th>
                    <th className="pb-2.5 text-right font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f7f3ed]">
                  {queue.slice(0, 5).map(job => (
                    <tr key={job.id} className="hover:bg-[#fcfaf7] transition-colors">
                      <td className="py-3 font-mono font-semibold text-[#251c17]">{job.id.slice(0, 8)}</td>
                      <td className="py-3 text-[#52473f]">
                        <span className="font-medium text-[#251c17]">{job.file_name}</span>
                        <div className="text-[11px] text-[#8a7e74]">
                          {job.page_count} pgs · {job.is_color ? 'Color' : 'B&W'} · {job.duplex_mode}
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          job.job_status === 'queued' ? 'bg-[#eef3eb] text-[#2f5a25]' :
                          job.job_status === 'processing' ? 'bg-[#fff2eb] text-[#c85a32]' :
                          job.job_status === 'completed' ? 'bg-[#f0fdf4] text-[#15803d]' :
                          'bg-[#fef2f2] text-[#b91c1c]'
                        }`}>
                          {job.job_status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => handleOpenJob(job.id)}
                          className="px-2.5 py-1 rounded-lg border border-[#e2dad0] hover:border-[#ea7c50] text-[#52473f] hover:text-[#ea7c50] font-medium transition-colors cursor-pointer text-[11px]"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Printer Status Cards */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
            <h2 className="font-serif text-lg text-[#251c17]">Printer status ({shop.printers?.length ?? 0} devices)</h2>
            <button
              onClick={() => setActiveTab('printers')}
              className="text-xs font-semibold text-[#ea7c50] hover:text-[#d75d31] flex items-center gap-1 cursor-pointer"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {shop.printers?.map(p => (
              <div key={p.id} className="p-4 rounded-xl border border-[#e2dad0] bg-[#fbf9f6] flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white border border-[#e2dad0] flex items-center justify-center text-[#70645a] shrink-0 mt-0.5">
                    <Printer className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-semibold text-xs text-[#251c17]">{p.device_name}</div>
                    <div className="text-[11px] text-[#8a7e74] mt-0.5">
                      {p.max_paper_size} · {p.is_color_supported ? 'Color & B&W' : 'B&W only'} · {p.is_duplex_supported ? 'Duplex' : 'Simplex'}
                    </div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                  p.status === 'online' ? 'bg-[#eef3eb] text-[#2f5a25]' : 'bg-[#fef2f2] text-[#b91c1c]'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${p.status === 'online' ? 'bg-[#34a853]' : 'bg-[#dc2626]'}`} />
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom: Recent Activity Log */}
      <div className="bg-white rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#f0eae1]">
          <h2 className="font-serif text-lg text-[#251c17]">Recent operator activity</h2>
          <span className="text-xs text-[#91857a] font-mono">Durable audit trail</span>
        </div>
        {!activity.length ? (
          <div className="text-center py-6 text-xs text-[#8a7e74]">No recorded staff actions yet today.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#f0eae1] text-[#91857a] font-medium text-[11px]">
                  <th className="pb-2.5 font-medium">Timestamp</th>
                  <th className="pb-2.5 font-medium">Operator</th>
                  <th className="pb-2.5 font-medium">Action</th>
                  <th className="pb-2.5 font-medium">Target / Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f7f3ed]">
                {activity.slice(0, 6).map(act => (
                  <tr key={act.id} className="hover:bg-[#fcfaf7]">
                    <td className="py-2.5 font-mono text-[11px] text-[#8a7e74]">{new Date(act.created_at).toLocaleTimeString()}</td>
                    <td className="py-2.5 font-semibold text-[#251c17]">{act.actor ?? 'System'}</td>
                    <td className="py-2.5 text-[#52473f]">
                      <span className="font-mono text-[11px] bg-[#f5f1e9] px-2 py-0.5 rounded border border-[#e5dec5]">
                        {act.action}
                      </span>
                    </td>
                    <td className="py-2.5 text-[#70645a] font-mono text-[11px]">{act.target ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
