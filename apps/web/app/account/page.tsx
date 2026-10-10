'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, ShieldCheck } from 'lucide-react';
import { fetchCustomerDocuments, fetchCustomerJobs } from '@/lib/api';
import { CustomerDocument, CustomerJob } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import StartWithDocumentCard from '@/components/customer/workspace/StartWithDocumentCard';
import LatestJobCard from '@/components/customer/workspace/LatestJobCard';
import RecentDocumentsTable from '@/components/customer/workspace/RecentDocumentsTable';
import WorkspaceStatsShelf from '@/components/customer/workspace/WorkspaceStatsShelf';
import WorkspaceHowItWorksShelf from '@/components/customer/workspace/WorkspaceHowItWorksShelf';
import WorkspaceUploadModal from '@/components/customer/workspace/WorkspaceUploadModal';
import WorkspaceAliasPromptModal from '@/components/customer/workspace/WorkspaceAliasPromptModal';

export default function CustomerAccountOverviewPage() {
  const { session, loading: authLoading } = useCustomerAuth();
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [latestJob, setLatestJob] = useState<CustomerJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [aliasPromptDismissed, setAliasPromptDismissed] = useState(false);

  const refresh = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const [docs, jobs] = await Promise.all([
        fetchCustomerDocuments({ limit: 10 }),
        fetchCustomerJobs({ limit: 5 }),
      ]);
      setDocuments(docs);
      setLatestJob(jobs.length > 0 ? jobs[0] : null);
    } catch {
      // Handled via empty states
    } finally {
      setLoading(false);
    }
  }, [session]);

  useEffect(() => {
    if (session) {
      void refresh();
    }
  }, [session, refresh]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-lg text-[#66554b]" role="status">
        Opening your workspace…
      </main>
    );
  }

  if (!session) {
    return <AccountSignedOutView initialMode="login" />;
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="overview" />

      <main className="flex-1 max-w-[1640px] 2xl:max-w-[1760px] w-full mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-10 sm:py-14 space-y-10 sm:space-y-12">
        {/* Page Top Title Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-serif text-[#241814] font-normal tracking-tight leading-tight">
              A little less waiting.
            </h1>
            <p className="text-lg sm:text-xl lg:text-[1.35rem] text-[#66554b] mt-2 sm:mt-3 font-normal max-w-2xl leading-relaxed">
              Your files and print jobs, in one place.
            </p>
          </div>

          <div>
            <Link
              href="/account/print/new"
              className="inline-flex items-center gap-3 h-13 sm:h-14 px-8 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base sm:text-lg font-semibold shadow-lg shadow-[#c05634]/25 hover:shadow-xl hover:shadow-[#c05634]/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>New print</span>
            </Link>
          </div>
        </div>

        {/* Shelf: Summary Statistics */}
        <WorkspaceStatsShelf documents={documents} latestJob={latestJob} />

        {/* Top Two Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 xl:col-span-8">
            <StartWithDocumentCard onUploadClick={() => setUploadModalOpen(true)} />
          </div>
          <div className="lg:col-span-5 xl:col-span-4">
            <LatestJobCard job={latestJob} loading={loading} />
          </div>
        </div>

        {/* Recent Documents Table */}
        <RecentDocumentsTable
          documents={documents}
          loading={loading}
          onRefresh={refresh}
          onUploadClick={() => setUploadModalOpen(true)}
        />

        {/* Architectural 3-Step Touchless Guide */}
        <WorkspaceHowItWorksShelf />

        {/* Trust & Privacy Security Banner */}
        <section
          aria-label="Privacy and security guarantee"
          className="bg-[#231713] text-[#f7f4ee] rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 border border-black/30"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#ea7c50] flex-shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-base sm:text-lg font-semibold text-white">
                Strict Customer Privacy & Isolation Guarantee
              </p>
              <p className="text-xs sm:text-sm text-[#d4c8bd] mt-0.5 max-w-2xl leading-relaxed">
                Documents stored in your library are encrypted and inaccessible to other users or public search engines. No USB drives, no lost files.
              </p>
            </div>
          </div>

          <Link
            href="/help"
            className="px-6 py-2.5 rounded-xl border border-white/20 hover:bg-white/10 text-xs sm:text-sm font-semibold text-white transition-colors whitespace-nowrap"
          >
            Read security spec
          </Link>
        </section>
      </main>

      <WorkspaceUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={refresh}
      />

      <WorkspaceAliasPromptModal
        isOpen={Boolean(session && session.user.alias_chosen === false && !aliasPromptDismissed)}
        onClose={() => setAliasPromptDismissed(true)}
      />
    </div>
  );
}
