'use client';
import React from 'react';
import { QueueItem } from '@/lib/api';

export default function LiveQueueMonitor({ queue }: { queue: QueueItem[] }) {
  return (
    <section className="glass-panel rounded-3xl p-6 border border-[#f5efe6]/10">
      <h2 className="text-lg font-bold text-[#fbf9f5] mb-2">Counter queue · {queue.length} jobs</h2>
      <p className="text-xs text-[#ba9e88] mb-4">Release and retry jobs from the desktop agent using the customer's code.</p>
      {!queue.length && <p className="text-sm text-[#ba9e88]">No active jobs.</p>}
      <ul className="space-y-3">
        {queue.map(job => (
          <li key={job.id} className="rounded-2xl bg-[#14100e]/70 border border-[#f5efe6]/10 p-4 flex justify-between gap-4 items-center">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[#fbf9f5] text-sm">{job.file_name}</p>
              <p className="text-xs text-[#ba9e88] mt-0.5">{job.page_count} pages · {job.copy_count} copies · {job.is_color ? 'Color' : 'B&W'}</p>
            </div>
            <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full ${job.job_status === 'failed' ? 'bg-[#451a1a]/60 text-[#fca5a5] border border-[#f87171]/30' : 'bg-[#ea7c50]/15 text-[#ea7c50] border border-[#ea7c50]/30'}`}>
              {job.job_status}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
