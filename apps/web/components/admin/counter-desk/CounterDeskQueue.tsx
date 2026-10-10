'use client';

import React, { useState } from 'react';
import { CounterDeskContextType } from './types';
import { QueueItem } from '@/lib/types';
import { Search, Filter, FileText, ArrowRight, XCircle, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

export default function CounterDeskQueue({ ctx }: { ctx: CounterDeskContextType }) {
  const { queue, selectedJobId, setSelectedJobId, setViewingJobDetail } = ctx;
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'processing' | 'attention' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredJobs = queue.filter(job => {
    const matchesSearch = 
      job.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;

    if (filterStatus === 'ready') return job.job_status === 'queued' || job.job_status === 'staged';
    if (filterStatus === 'processing') return job.job_status === 'processing';
    if (filterStatus === 'attention') return job.job_status === 'failed' || Boolean(job.cleanup_pending);
    if (filterStatus === 'completed') return job.job_status === 'completed';
    return true;
  });

  const selectedJob = queue.find(j => j.id === selectedJobId) || filteredJobs[0] || null;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#e2dad0]">
        <div>
          <h1 className="font-serif text-3xl text-[#251c17] tracking-tight">Print Queue Ledger</h1>
          <p className="text-sm text-[#70645a] mt-1">Review active, processing, and completed print orders for your counter.</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#91857a]" />
            <input
              type="text"
              placeholder="Search reference, file..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#e2dad0] bg-white text-xs text-[#251c17] placeholder-[#91857a] focus:outline-none focus:border-[#ea7c50]"
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'ready', 'processing', 'attention', 'completed'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilterStatus(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold capitalize transition-colors cursor-pointer ${
              filterStatus === tab
                ? 'bg-[#3b5232] text-white shadow-sm'
                : 'bg-white border border-[#e2dad0] text-[#70645a] hover:bg-[#fcfaf7]'
            }`}
          >
            {tab === 'all' ? `All (${queue.length})` : tab}
          </button>
        ))}
      </div>

      {/* Ledger Split: Table 65% / Details 35% */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Table Column */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-[#e2dad0] p-5 shadow-sm overflow-hidden">
          {!filteredJobs.length ? (
            <div className="text-center py-16 text-xs text-[#8a7e74]">
              No jobs matching the selected filter or query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#f0eae1] text-[#91857a] font-medium text-[11px]">
                    <th className="pb-3 pl-2">Ref</th>
                    <th className="pb-3">Document</th>
                    <th className="pb-3">Specs</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right pr-2">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f7f3ed]">
                  {filteredJobs.map(job => {
                    const isSelected = selectedJob?.id === job.id;
                    return (
                      <tr
                        key={job.id}
                        onClick={() => setSelectedJobId(job.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#f7f4ee]' : 'hover:bg-[#fcfaf7]'
                        }`}
                      >
                        <td className="py-3.5 pl-2 font-mono font-semibold text-[#251c17]">
                          {job.id.slice(0, 8)}
                        </td>
                        <td className="py-3.5">
                          <div className="font-medium text-[#251c17] truncate max-w-[200px]" title={job.file_name}>
                            {job.file_name}
                          </div>
                          <div className="text-[11px] text-[#8a7e74] mt-0.5">
                            {job.page_count} pgs · {job.copies} copy
                          </div>
                        </td>
                        <td className="py-3.5">
                          <div className="text-[#52473f]">
                            {job.is_color ? 'Color' : 'B&W'} · {job.duplex_mode}
                          </div>
                          <div className="text-[11px] text-[#8a7e74]">
                            {job.paper_type ? job.paper_type.toUpperCase() : 'NORMAL'} · {job.layout_nup ? `${job.layout_nup}-Up` : '1-Up'}
                          </div>
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                            job.job_status === 'queued' ? 'bg-[#eef3eb] text-[#2f5a25]' :
                            job.job_status === 'processing' ? 'bg-[#fff2eb] text-[#c85a32]' :
                            job.job_status === 'completed' ? 'bg-[#f0fdf4] text-[#15803d]' :
                            'bg-[#fef2f2] text-[#b91c1c]'
                          }`}>
                            {job.job_status}
                          </span>
                        </td>
                        <td className="py-3.5 text-right pr-2 font-mono font-bold text-[#251c17]">
                          ₹{job.total_amount_in_inr ?? '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Selected Job Drawer (35%) */}
        <div className="lg:col-span-4 bg-[#fbf9f6] rounded-2xl border border-[#e2dad0] p-6 shadow-sm space-y-6">
          {selectedJob ? (
            <>
              <div className="flex items-start justify-between border-b border-[#e5dec5] pb-4">
                <div>
                  <span className="text-[11px] font-mono uppercase text-[#70645a]">Selected Job</span>
                  <h3 className="font-serif text-xl font-bold text-[#251c17] mt-0.5">
                    {selectedJob.id.slice(0, 10)}
                  </h3>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                  selectedJob.job_status === 'queued' ? 'bg-[#eef3eb] text-[#2f5a25]' :
                  selectedJob.job_status === 'processing' ? 'bg-[#fff2eb] text-[#c85a32]' :
                  selectedJob.job_status === 'completed' ? 'bg-[#f0fdf4] text-[#15803d]' :
                  'bg-[#fef2f2] text-[#b91c1c]'
                }`}>
                  {selectedJob.job_status}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-1 border-b border-[#ede5d8]">
                  <span className="text-[#70645a]">Document:</span>
                  <span className="font-medium text-[#251c17] truncate max-w-[180px]">{selectedJob.file_name}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ede5d8]">
                  <span className="text-[#70645a]">Pages / Copies:</span>
                  <span className="font-medium text-[#251c17]">{selectedJob.page_count} pgs / {selectedJob.copies} copy</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ede5d8]">
                  <span className="text-[#70645a]">Paper & Layout:</span>
                  <span className="font-medium text-[#251c17]">{selectedJob.paper_type?.toUpperCase() ?? 'NORMAL'} · {selectedJob.layout_nup ?? 1}-Up</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ede5d8]">
                  <span className="text-[#70645a]">Color / Duplex:</span>
                  <span className="font-medium text-[#251c17]">{selectedJob.is_color ? 'Color' : 'Black & White'} · {selectedJob.duplex_mode}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-[#ede5d8]">
                  <span className="text-[#70645a]">Customer Phone:</span>
                  <span className="font-mono text-[#251c17]">{selectedJob.customer_phone ?? 'Anonymous pickup'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-[#70645a] font-semibold">Calculated Amount:</span>
                  <span className="font-mono font-bold text-sm text-[#251c17]">₹{selectedJob.total_amount_in_inr ?? '-'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={() => {
                    setSelectedJobId(selectedJob.id);
                    setViewingJobDetail(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#ea7c50] hover:bg-[#d75d31] text-white font-semibold text-xs shadow-sm cursor-pointer transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  <span>Inspect Job Details</span>
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-xs text-[#8a7e74]">
              Select a job from the ledger to view its configuration and dispatch actions.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
