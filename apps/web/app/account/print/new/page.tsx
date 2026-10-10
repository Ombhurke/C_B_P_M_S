'use client';

import React, { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FileText, ArrowLeft, Store, ShieldAlert, ArrowRight } from 'lucide-react';
import { fetchCustomerDocument, fetchShops } from '@/lib/api';
import { CustomerDocument, Shop } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';

function NewPrintContent() {
  const searchParams = useSearchParams();
  const docId = searchParams.get('doc');
  const [document, setDocument] = useState<CustomerDocument | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [loadedShops, loadedDoc] = await Promise.all([
          fetchShops().catch(() => []),
          docId ? fetchCustomerDocument(docId).catch(() => null) : Promise.resolve(null),
        ]);
        setShops(loadedShops || []);
        setDocument(loadedDoc);
      } finally {
        setLoading(false);
      }
    }
    void loadData();
  }, [docId]);

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 sm:px-10 lg:px-14 py-8 sm:py-12 space-y-8">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#66554b] hover:text-[#241814] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to overview</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl font-serif text-[#241814] font-normal tracking-tight">
            Prepare a print request
          </h1>
          <p className="text-base text-[#66554b] mt-1">
            Choose your document and check counter availability.
          </p>
        </div>

        {/* Selected Document Card */}
        {document && (
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-6 shadow-sm flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-14 rounded-xl bg-[#faf6f0] border border-[#e8dfd3] flex items-center justify-center">
                <FileText className="w-6 h-6 text-[#a39484]" />
              </div>
              <div>
                <p className="text-xs text-[#8c7b70] uppercase tracking-wider font-semibold">Selected Document</p>
                <h3 className="text-lg font-bold text-[#241814]">{document.file_name}</h3>
                <p className="text-xs text-[#66554b]">
                  {document.page_count ? `${document.page_count} pages · ` : ''}{(document.file_size_bytes / (1024 * 1024)).toFixed(1)} MB
                </p>
              </div>
            </div>

            <Link
              href="/account/documents"
              className="text-xs sm:text-sm font-semibold text-[#c05634] hover:underline"
            >
              Choose different file
            </Link>
          </div>
        )}

        {/* Counter Availability Boundary */}
        {loading ? (
          <div className="bg-white rounded-3xl p-12 border border-[#e6dfd5] text-center animate-pulse">
            <p className="text-sm text-[#66554b]">Checking available counters…</p>
          </div>
        ) : shops.length === 0 ? (
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-8 sm:p-12 text-center shadow-sm space-y-5 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#fdf3ea] border border-[#f5d0b5] flex items-center justify-center text-[#c05634] mx-auto">
              <Store className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-serif font-bold text-[#241814]">
                No counters currently available
              </h2>
              <p className="text-sm text-[#66554b] leading-relaxed">
                Partner print shops are currently being onboarded. Print job submission, pricing, and counter pickup will be enabled once physical print counters are active.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#faf7f3] border border-[#efe6db] text-xs text-[#66554b] flex items-start gap-3 text-left">
              <ShieldAlert className="w-4 h-4 text-[#c05634] flex-shrink-0 mt-0.5" />
              <span>
                Your files remain completely safe in your private document shelf. No fake charges or empty orders are placed.
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Link
                href="/account/documents"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold shadow-md shadow-[#c05634]/20 transition-all"
              >
                <span>Return to my library</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <Link
                href="/shops"
                className="px-6 py-3 rounded-xl border border-[#dcd4c8] hover:bg-neutral-50 text-xs sm:text-sm font-semibold text-[#3d2f28] transition-colors"
              >
                View shop directory
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-[#e6dfd5] rounded-3xl p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#241814] mb-4">Select a counter to proceed</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {shops.map((s) => (
                <Link
                  key={s.id}
                  href={`/shop/${encodeURIComponent(s.id)}`}
                  className="p-5 rounded-2xl border border-[#e6dfd5] hover:border-[#c05634] transition-colors block"
                >
                  <p className="font-bold text-[#241814]">{s.name}</p>
                  <p className="text-xs text-[#66554b] mt-1">{s.address}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function NewPrintPage() {
  const { session, loading: authLoading } = useCustomerAuth();

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-base text-[#66554b]" role="status">
        Loading…
      </main>
    );
  }

  if (!session) {
    return <AccountSignedOutView initialMode="login" />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f4ee] p-12 text-center text-sm">Loading…</div>}>
      <NewPrintContent />
    </Suspense>
  );
}
