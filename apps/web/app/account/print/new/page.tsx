'use client';

import React, { useEffect, useState, Suspense, useCallback } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FileText,
  ArrowLeft,
  Store,
  RefreshCw,
  ChevronRight,
  Check,
} from 'lucide-react';
import { fetchCustomerDocument, fetchCustomerDocuments, fetchShops, uploadCustomerDocument, uploadCustomerDocumentsBatch } from '@/lib/api';
import { CustomerDocument, Shop } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import UploadBox from '@/components/customer/UploadBox';

function NewPrintContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const docId = searchParams.get('doc');

  const [documentMode, setDocumentMode] = useState<'library' | 'upload'>('library');
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CustomerDocument | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingShops, setRefreshingShops] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedShops, loadedDocs, targetDoc] = await Promise.all([
        fetchShops().catch(() => []),
        fetchCustomerDocuments().catch(() => []),
        docId ? fetchCustomerDocument(docId).catch(() => null) : Promise.resolve(null),
      ]);
      setShops(loadedShops || []);
      setDocuments(loadedDocs || []);

      if (targetDoc) {
        setSelectedDoc(targetDoc);
      } else if (loadedDocs && loadedDocs.length > 0) {
        setSelectedDoc(loadedDocs[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleRefreshShops = async () => {
    setRefreshingShops(true);
    try {
      const reloaded = await fetchShops();
      setShops(reloaded || []);
    } catch {
      // Ignored
    } finally {
      setRefreshingShops(false);
    }
  };

  const handleUploadNew = async (file: File, folderFiles?: File[], isFolder?: boolean) => {
    setUploading(true);
    setUploadError('');
    try {
      if (isFolder && folderFiles && folderFiles.length > 0) {
        const uploadedBatch = await uploadCustomerDocumentsBatch(folderFiles);
        setDocuments((prev) => [...uploadedBatch, ...prev]);
        if (uploadedBatch.length > 0) {
          setSelectedDoc(uploadedBatch[0]);
        }
        setDocumentMode('library');
      } else {
        const uploaded = await uploadCustomerDocument(file);
        setDocuments((prev) => [uploaded, ...prev]);
        setSelectedDoc(uploaded);
        setDocumentMode('library');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload could not be saved to library');
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = () => {
    if (!selectedShop || !selectedDoc) return;
    router.push(`/shop/${encodeURIComponent(selectedShop.id)}?doc=${encodeURIComponent(selectedDoc.id)}`);
  };

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="shops" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-8 sm:py-12 space-y-8">
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#66554b] hover:text-[#241814] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to workspace</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-serif text-[#241814] font-normal tracking-tight">
            Start with a document.
          </h1>
          <p className="text-base sm:text-lg text-[#66554b] mt-1">
            Choose a saved file or upload a new one, then select a print shop.
          </p>
        </div>

        {/* 2-Column Split: Left = Choose document, Right = Select shop */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Choose a document (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-7 bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                  Choose a document
                </h2>
                <p className="text-xs sm:text-sm text-[#66554b] mt-0.5">
                  Select which file to send to the counter.
                </p>
              </div>

              {/* Segmented switcher */}
              <div className="flex items-center bg-[#faf6f0] border border-[#e6dfd5] p-1 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setDocumentMode('library')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    documentMode === 'library'
                      ? 'bg-white text-[#241814] shadow-xs'
                      : 'text-[#66554b] hover:text-[#241814]'
                  }`}
                >
                  From my prints
                </button>
                <button
                  type="button"
                  onClick={() => setDocumentMode('upload')}
                  className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                    documentMode === 'upload'
                      ? 'bg-white text-[#241814] shadow-xs'
                      : 'text-[#66554b] hover:text-[#241814]'
                  }`}
                >
                  Upload new
                </button>
              </div>
            </div>

            {documentMode === 'library' ? (
              loading ? (
                <div className="space-y-3 animate-pulse">
                  <div className="h-20 bg-[#faf6f0] rounded-2xl border border-[#e6dfd5]" />
                  <div className="h-20 bg-[#faf6f0] rounded-2xl border border-[#e6dfd5]" />
                </div>
              ) : documents.length === 0 ? (
                <div className="p-8 text-center bg-[#faf6f0] border-2 border-dashed border-[#e6dfd5] rounded-2xl space-y-3">
                  <p className="text-base font-bold text-[#241814]">Your library is empty</p>
                  <p className="text-xs sm:text-sm text-[#66554b]">
                    You haven&apos;t saved any documents to your private shelf yet.
                  </p>
                  <button
                    type="button"
                    onClick={() => setDocumentMode('upload')}
                    className="px-5 py-2.5 rounded-xl bg-[#c05634] text-white text-xs font-semibold hover:bg-[#a94829] transition-all cursor-pointer"
                  >
                    Upload a document now
                  </button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                  {documents.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedDoc(doc)}
                        className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between gap-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#c05634] bg-[#fdf3ea] shadow-xs'
                            : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-white border border-[#ded5c7] flex items-center justify-center text-[#c05634] flex-shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-[#241814] text-sm sm:text-base truncate">{doc.file_name}</p>
                            <p className="text-xs text-[#66554b] mt-0.5">
                              {doc.page_count ? `${doc.page_count} pages · ` : ''}
                              {(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB · PDF
                            </p>
                          </div>
                        </div>

                        {isSelected && (
                          <div className="w-6 h-6 rounded-full bg-[#c05634] text-white flex items-center justify-center flex-shrink-0">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              <div className="space-y-4">
                <UploadBox
                  onFileSelect={(file, _pages, folderFiles, isFolder) => void handleUploadNew(file, folderFiles, isFolder)}
                  onClear={() => {}}
                  selectedFile={null}
                  pageCount={1}
                />
                {uploading && (
                  <p className="text-xs text-[#c05634] font-medium text-center">
                    Saving document to your private library…
                  </p>
                )}
                {uploadError && (
                  <p className="text-xs text-red-700 bg-red-50 p-3 rounded-xl border border-red-200">
                    {uploadError}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Select a print shop (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-5 bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-6 text-left">
            <div>
              <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                Select a print shop
              </h2>
              <p className="text-xs sm:text-sm text-[#66554b] mt-0.5">
                Physical counter location for pickup.
              </p>
            </div>

            {loading ? (
              <div className="p-8 text-center animate-pulse">
                <p className="text-sm text-[#66554b]">Checking active counters…</p>
              </div>
            ) : shops.length === 0 ? (
              /* Calm Honest Empty State (Visual 07) */
              <div className="p-8 sm:p-10 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-white border border-[#ded5c7] flex items-center justify-center text-[#c05634] mx-auto shadow-xs">
                  <Store className="w-8 h-8" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-serif font-bold text-[#241814]">
                    No print shops available
                  </h3>
                  <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
                    Your documents are still available in your private library. Printing will become available when a shop is connected.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    href="/account/documents"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs"
                  >
                    View my prints
                  </Link>

                  <button
                    type="button"
                    onClick={handleRefreshShops}
                    disabled={refreshingShops}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-[#dcd4c8] bg-white hover:bg-neutral-50 text-xs sm:text-sm font-semibold text-[#3d2f28] transition-colors inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshingShops ? 'animate-spin' : ''}`} />
                    <span>{refreshingShops ? 'Checking…' : 'Refresh shop list'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                {shops.map((s) => {
                  const isSelected = selectedShop?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedShop(s)}
                      className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isSelected
                          ? 'border-[#c05634] bg-[#fdf3ea] shadow-xs'
                          : 'border-[#e6dfd5] bg-[#faf6f0] hover:border-[#c05634]/40'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-[#241814] text-sm sm:text-base">{s.name}</p>
                        <p className="text-xs text-[#8c7b70] mt-0.5">{s.address || 'Campus counter'}</p>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[#c05634] text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-4 h-4" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Action Footer */}
        <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-[#66554b]">
            {selectedDoc ? (
              <span>Document: <strong>{selectedDoc.file_name}</strong></span>
            ) : (
              <span>No document selected</span>
            )}
            {selectedShop && (
              <span className="ml-2 pl-2 border-l border-[#e6dfd5]">
                Counter: <strong>{selectedShop.name}</strong>
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              disabled={!selectedDoc || !selectedShop}
              onClick={handleContinue}
              className="px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>Continue to print options</span>
              <ChevronRight className="w-5 h-5" />
            </button>
            {(!selectedShop || shops.length === 0) && (
              <span className="text-xs text-[#8c7b70] text-center sm:text-right">
                Select an available shop to continue.
              </span>
            )}
          </div>
        </div>
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
