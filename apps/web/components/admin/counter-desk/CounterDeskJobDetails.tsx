'use client';

import React, { useState } from 'react';
import { CounterDeskContextType } from './types';
import { request } from '@/lib/api';
import { ArrowLeft, CheckCircle2, Clock, XCircle, AlertTriangle, Printer, ShieldAlert } from 'lucide-react';

export default function CounterDeskJobDetails({ ctx }: { ctx: CounterDeskContextType }) {
  const { shop, queue, selectedJobId, setViewingJobDetail, refreshData, token } = ctx;
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('Out of stock paper');
  const [rejectNote, setRejectNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const job = queue.find(j => j.id === selectedJobId) || null;

  if (!job) {
    return (
      <div className="p-8 text-center space-y-4">
        <p className="text-sm text-[#70645a]">No job selected or job has been purged from the queue.</p>
        <button
          onClick={() => setViewingJobDetail(false)}
          className="px-4 py-2 rounded-xl bg-[#3b5232] text-white text-xs font-semibold cursor-pointer"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  const handleReject = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await request(`/shops/${shop.id}/jobs/${job.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: rejectReason,
          note: rejectNote || undefined
        })
      }, token);
      setIsRejecting(false);
      await refreshData();
      setViewingJobDetail(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { label: 'Staged & Ready', done: true, current: job.job_status === 'queued' || job.job_status === 'staged' },
    { label: 'Spooling / Printing', done: job.job_status === 'processing' || job.job_status === 'completed', current: job.job_status === 'processing' },
    { label: 'Completed', done: job.job_status === 'completed', current: job.job_status === 'completed' }
  ];

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl">
      {/* Top Nav */}
      <div className="flex items-center justify-between pb-4 border-b border-[#e2dad0]">
        <button
          onClick={() => setViewingJobDetail(false)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#52473f] hover:text-[#ea7c50] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to queue ledger</span>
        </button>
        <div className="font-mono text-xs text-[#91857a]">Job ID: {job.id}</div>
      </div>

      {/* Title & Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase text-[#70645a]">Print Order Inspection</span>
          <h1 className="font-serif text-3xl text-[#251c17] mt-1">{job.file_name}</h1>
          <p className="text-xs text-[#70645a] mt-1">Submitted for counter fulfillment at {shop.name}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
            job.job_status === 'queued' ? 'bg-[#eef3eb] text-[#2f5a25]' :
            job.job_status === 'processing' ? 'bg-[#fff2eb] text-[#c85a32]' :
            job.job_status === 'completed' ? 'bg-[#f0fdf4] text-[#15803d]' :
            'bg-[#fef2f2] text-[#b91c1c]'
          }`}>
            Status: {job.job_status}
          </span>
          {job.job_status !== 'completed' && job.job_status !== 'failed' && (
            <button
              onClick={() => setIsRejecting(true)}
              className="px-4 py-2 rounded-xl border border-[#f5c6cb] bg-[#fff5f5] text-[#b91c1c] text-xs font-semibold hover:bg-[#fed7d7] transition-colors cursor-pointer"
            >
              Reject Job
            </button>
          )}
        </div>
      </div>

      {/* 3-Step Progress Track */}
      <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm">
        <div className="text-xs font-semibold text-[#70645a] mb-4">Fulfillment Stage</div>
        <div className="grid grid-cols-3 gap-2 relative">
          {steps.map((st, i) => (
            <div key={st.label} className="flex flex-col items-center text-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mb-2 transition-colors ${
                st.done ? 'bg-[#3b5232] text-white' : 'bg-[#ede5d8] text-[#91857a]'
              }`}>
                {st.done ? <CheckCircle2 className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-xs font-medium ${st.current ? 'text-[#251c17] font-bold' : 'text-[#70645a]'}`}>
                {st.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Grid: Document Specifications & Pricing */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Specs */}
        <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-[#251c17]">Document Specifications</h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Page Count:</span>
              <span className="font-semibold text-[#251c17]">{job.page_count} pages</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Copies Requested:</span>
              <span className="font-semibold text-[#251c17]">{job.copies} copy</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Color Mode:</span>
              <span className="font-semibold text-[#251c17]">{job.is_color ? 'Color' : 'Monochrome (B&W)'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Sides / Duplex:</span>
              <span className="font-semibold text-[#251c17]">{job.duplex_mode === 'duplex' ? 'Double-sided (Duplex)' : 'Single-sided (Simplex)'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Paper Stock:</span>
              <span className="font-semibold text-[#251c17]">{job.paper_type === 'bond' ? 'Bond Paper (Executive/Thesis)' : 'Standard (70–75 GSM)'}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#70645a]">Pages Per Sheet (N-Up):</span>
              <span className="font-semibold text-[#251c17]">{job.layout_nup ? `${job.layout_nup} pages per side` : '1 page per side'}</span>
            </div>
          </div>
        </div>

        {/* Financials & Customer */}
        <div className="bg-white p-6 rounded-2xl border border-[#e2dad0] shadow-sm space-y-4">
          <h2 className="font-serif text-lg text-[#251c17]">Payment & Settlement</h2>
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Payment Status:</span>
              <span className="font-semibold text-[#3b5232]">Pay at Counter / Direct</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Customer Reference:</span>
              <span className="font-mono text-[#251c17]">{job.customer_phone || 'In-person walkup'}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-[#f0eae1]">
              <span className="text-[#70645a]">Release Authorization:</span>
              <span className="font-semibold text-[#70645a]">Requires 4-Digit Release PIN</span>
            </div>
            <div className="flex justify-between py-2 items-center bg-[#fbf9f6] px-3 rounded-xl border border-[#ede5d8]">
              <span className="text-xs font-semibold text-[#251c17]">Total Due from Customer:</span>
              <span className="font-mono font-bold text-lg text-[#ea7c50]">₹{job.total_amount_in_inr ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Reject Modal */}
      {isRejecting && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-[#e2dad0] p-6 max-w-md w-full shadow-xl space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 text-[#b91c1c]">
              <ShieldAlert className="w-6 h-6 shrink-0" />
              <h3 className="font-serif text-lg font-bold text-[#251c17]">Reject Print Job</h3>
            </div>
            <p className="text-xs text-[#70645a]">
              This will mark the job as rejected and notify the customer. Physical document cleanup will be recorded.
            </p>
            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {errorMsg}
              </div>
            )}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-xs font-semibold text-[#251c17] mb-1">Reason for Rejection</label>
                <select
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] bg-white text-xs text-[#251c17]"
                >
                  <option value="Out of stock paper">Out of stock paper / Media unavailable</option>
                  <option value="Damaged file">Damaged or unreadable file format</option>
                  <option value="Printer mismatch">Hardware mismatch / Hardware offline</option>
                  <option value="Cancelled by customer">Customer cancelled at counter</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#251c17] mb-1">Optional Operator Note</label>
                <textarea
                  value={rejectNote}
                  onChange={e => setRejectNote(e.target.value)}
                  placeholder="Additional context for records..."
                  rows={2}
                  className="w-full p-2.5 rounded-xl border border-[#e2dad0] text-xs text-[#251c17]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsRejecting(false)}
                disabled={loading}
                className="px-4 py-2 rounded-xl border border-[#e2dad0] text-xs font-semibold text-[#70645a] hover:bg-[#fcfaf7] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
