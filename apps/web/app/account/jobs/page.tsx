'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, FileText, ChevronRight, Clock, CheckCircle2, AlertCircle, Inbox, Store } from 'lucide-react';
import { fetchCustomerJobs } from '@/lib/api';
import { CustomerJob } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import JobDetailPane from '@/components/customer/workspace/JobDetailPane';

export default function CustomerJobsPage() {
  const { session, loading: authLoading } = useCustomerAuth();
  const [jobs, setJobs] = useState<CustomerJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<CustomerJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'attention'>('all');
  const [search, setSearch] = useState('');

  const loadJobs = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const statusParam = statusFilter === 'all' ? undefined : statusFilter;
      const res = await fetchCustomerJobs({ status: statusParam, limit: 50 });
      setJobs(res);
      setSelectedJob((curr) => (!curr ? res[0] || null : res.find((j) => j.job_id === curr.job_id) || res[0] || null));
    } catch {
      // Handled via empty state
    } finally {
      setLoading(false);
    }
  }, [session, statusFilter]);

  useEffect(() => {
    if (session) void loadJobs();
  }, [session, loadJobs]);

  const filtered = jobs.filter((j) =>
    j.file_name.toLowerCase().includes(search.toLowerCase()) || j.shop_id.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return iso;
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-lg text-[#66554b]" role="status">
        Loading your print history…
      </main>
    );
  }

  if (!session) return <AccountSignedOutView initialMode="login" />;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="jobs" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-10 sm:py-14 space-y-10 sm:space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-serif text-[#241814] font-normal tracking-tight leading-tight">
              Every print, in view.
            </h1>
            <p className="text-lg sm:text-xl lg:text-[1.35rem] text-[#66554b] mt-2 sm:mt-3 font-normal max-w-2xl leading-relaxed">
              Track current requests and revisit your print history.
            </p>
          </div>

          <div>
            <Link
              href="/account/print/new"
              className="inline-flex items-center gap-3 h-13 sm:h-14 px-8 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base sm:text-lg font-semibold shadow-lg shadow-[#c05634]/25 hover:shadow-xl hover:shadow-[#c05634]/30 transition-all whitespace-nowrap"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>New print</span>
            </Link>
          </div>
        </div>

        {/* Toolbar: Status Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#e6dfd5] pb-3">
          <div className="flex items-center gap-8 overflow-x-auto">
            {(['all', 'active', 'completed', 'attention'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`pb-3 text-base sm:text-lg transition-colors relative cursor-pointer font-medium capitalize ${
                  statusFilter === tab ? 'text-[#c05634] font-bold' : 'text-[#66554b] hover:text-[#241814]'
                }`}
              >
                {tab === 'attention' ? 'Needs attention' : `${tab} jobs`}
                {statusFilter === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#c05634] rounded-t-sm" />
                )}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-80">
            <Search className="w-5 h-5 text-[#8c7b70] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search jobs…"
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-[#dcd4c8] bg-white text-sm text-[#241814] focus:outline-none focus:border-[#c05634] transition-colors"
            />
          </div>
        </div>

        {/* Main Content Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-[#e6dfd5] p-8 sm:p-10 shadow-xs overflow-hidden">
            {loading ? (
              <div className="space-y-4 py-8 animate-pulse">
                <div className="h-14 bg-neutral-100 rounded-2xl" />
                <div className="h-16 bg-neutral-50 rounded-2xl" />
                <div className="h-16 bg-neutral-50 rounded-2xl" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 px-6 text-center text-[#8c7b70] space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#d4c8bb] mx-auto">
                  <Inbox className="w-8 h-8" />
                </div>
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-2xl font-serif font-bold text-[#241814]">No print jobs found</h3>
                  <p className="text-base text-[#66554b] leading-relaxed">
                    {search ? 'Try another search keyword.' : 'You have not submitted any print jobs yet.'}
                  </p>
                </div>
                {!search && (
                  <div className="pt-2">
                    <Link
                      href="/account/print/new"
                      className="inline-flex items-center gap-2 px-7 py-3 rounded-xl bg-[#c05634] text-white font-semibold text-sm hover:bg-[#a94829] transition-colors"
                    >
                      Prepare a print
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#efe7dd] text-[#8c7b70] text-xs font-semibold uppercase tracking-wider">
                      <th className="py-4 px-4">Document</th>
                      <th className="py-4 px-4">Shop</th>
                      <th className="py-4 px-4">Status</th>
                      <th className="py-4 px-4">Total</th>
                      <th className="py-4 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4eee6]">
                    {filtered.map((job) => {
                      const isSelected = selectedJob?.job_id === job.job_id;
                      return (
                        <tr
                          key={job.job_id}
                          onClick={() => setSelectedJob(job)}
                          className={`cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#faf6f0] border-l-4 border-l-[#c05634]' : 'hover:bg-[#faf7f3]'
                          }`}
                        >
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-12 rounded-xl bg-[#f4eee6] border border-[#e6ded3] flex items-center justify-center flex-shrink-0">
                                <FileText className="w-5 h-5 text-[#a39484]" />
                              </div>
                              <div>
                                <p className="font-bold text-[#241814] truncate max-w-xs sm:max-w-md text-base">{job.file_name}</p>
                                <p className="text-xs text-[#8c7b70]">{formatDate(job.created_at)} · {job.copy_count} copies</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-[#66554b] font-mono text-xs">{job.shop_id}</td>
                          <td className="py-4 px-4 whitespace-nowrap">
                            {job.job_status === 'completed' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Completed</span>
                              </span>
                            ) : job.payment_method === 'counter' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf3ea] text-[#8c4320] border border-[#f5d0b5] text-xs font-semibold">
                                <Store className="w-3.5 h-3.5 text-[#c05634]" />
                                <span>Pay at counter</span>
                              </span>
                            ) : job.payment_status === 'completed' || job.payment_status === 'paid' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Payment verified</span>
                              </span>
                            ) : job.payment_status === 'pending' ? (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#faebe6] text-[#b85333] text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Awaiting payment</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 text-xs font-semibold">
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span className="capitalize">{job.job_status}</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 font-bold text-[#241814] whitespace-nowrap">
                            {job.currency} {job.total_cost}
                          </td>
                          <td className="py-4 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedJob(job);
                              }}
                              className="px-4 py-2 rounded-xl border border-[#c05634] text-[#c05634] hover:bg-[#c05634] hover:text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 transition-all"
                            >
                              <span>View job</span>
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="pt-5 border-t border-[#f4eee6] text-xs sm:text-sm text-[#8c7b70] flex items-center justify-between">
              <span>Showing {filtered.length} print jobs</span>
            </div>
          </div>

          <div className="lg:col-span-5 xl:col-span-4 sticky top-28">
            <JobDetailPane job={selectedJob} />
          </div>
        </div>

        <p className="text-sm text-[#8c7b70] text-center pt-8 border-t border-[#ded5c7]">
          ⚡ Real-time status updates as your request moves through the counter queue.
        </p>
      </main>
    </div>
  );
}
