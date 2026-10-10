'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { Plus, UploadCloud } from 'lucide-react';
import { fetchCustomerDocuments, deleteCustomerDocument } from '@/lib/api';
import { CustomerDocument } from '@/lib/types';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import DocumentGridCard from '@/components/customer/workspace/DocumentGridCard';
import DocumentDetailPane from '@/components/customer/workspace/DocumentDetailPane';
import DocumentToolbar from '@/components/customer/workspace/DocumentToolbar';
import WorkspaceUploadModal from '@/components/customer/workspace/WorkspaceUploadModal';

export default function CustomerDocumentsPage() {
  const { session, loading: authLoading } = useCustomerAuth();
  const [documents, setDocuments] = useState<CustomerDocument[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<CustomerDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'images'>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'name_asc' | 'size_desc'>('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [busyDeleting, setBusyDeleting] = useState(false);

  const loadDocuments = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const typeParam = filterType === 'all' ? undefined : filterType === 'images' ? 'image' : 'pdf';
      const docs = await fetchCustomerDocuments({
        q: search ? search.trim() : undefined,
        type: typeParam,
        sort: sortBy,
        limit: 50,
      });
      setDocuments(docs);
      if (docs.length > 0) {
        setSelectedDoc((curr) => {
          if (!curr) return docs[0];
          return docs.find((d) => d.id === curr.id) || docs[0];
        });
      } else {
        setSelectedDoc(null);
      }
    } catch {
      // Handled via empty states
    } finally {
      setLoading(false);
    }
  }, [session, search, filterType, sortBy]);

  useEffect(() => {
    if (session) {
      void loadDocuments();
    }
  }, [session, loadDocuments]);

  const handleDelete = async (doc: CustomerDocument) => {
    if (!window.confirm(`Delete "${doc.file_name}" from your private library?`)) return;
    setBusyDeleting(true);
    try {
      await deleteCustomerDocument(doc.id);
      await loadDocuments();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Could not delete document');
    } finally {
      setBusyDeleting(false);
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-lg text-[#66554b]" role="status">
        Loading your document shelf…
      </main>
    );
  }

  if (!session) {
    return <AccountSignedOutView initialMode="login" />;
  }

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="documents" />

      <main className="flex-1 max-w-[1640px] 2xl:max-w-[1760px] w-full mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 py-10 sm:py-14 space-y-10 sm:space-y-12">
        {/* Page Title & Upload Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] xl:text-[3.75rem] font-serif text-[#241814] font-normal tracking-tight leading-tight">
              Your files, ready for next time.
            </h1>
            <p className="text-lg sm:text-xl lg:text-[1.35rem] text-[#66554b] mt-2 sm:mt-3 font-normal max-w-2xl leading-relaxed">
              A private library for the documents you print again.
            </p>
          </div>

          <div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(true)}
              className="inline-flex items-center gap-3 h-13 sm:h-14 px-8 rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base sm:text-lg font-semibold shadow-lg shadow-[#c05634]/25 hover:shadow-xl hover:shadow-[#c05634]/30 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-5 h-5 sm:w-6 sm:h-6" />
              <span>Upload document</span>
            </button>
          </div>
        </div>

        {/* Modular Filter & Search Toolbar */}
        <DocumentToolbar
          search={search}
          onSearchChange={setSearch}
          filterType={filterType}
          onFilterTypeChange={setFilterType}
          sortBy={sortBy}
          onSortByChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Documents Grid / List (Left Column) */}
          <div className="lg:col-span-7 xl:col-span-8">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 animate-pulse">
                <div className="h-52 bg-white rounded-3xl border border-[#e6dfd5]" />
                <div className="h-52 bg-white rounded-3xl border border-[#e6dfd5]" />
                <div className="h-52 bg-white rounded-3xl border border-[#e6dfd5]" />
                <div className="h-52 bg-white rounded-3xl border border-[#e6dfd5]" />
              </div>
            ) : documents.length === 0 ? (
              <div className="bg-white rounded-3xl border-2 border-dashed border-[#e6dfd5] p-16 text-center shadow-xs space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] mx-auto shadow-xs">
                  <UploadCloud className="w-10 h-10" />
                </div>
                <div className="space-y-2 max-w-md mx-auto">
                  <h3 className="text-2xl sm:text-3xl font-serif font-bold text-[#241814]">Your library is empty</h3>
                  <p className="text-base text-[#66554b] leading-relaxed">
                    {search
                      ? 'No documents matched your search term. Try clearing filters or search terms.'
                      : 'Upload a PDF or image to save it in your private library for instant, repeat printing.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadModalOpen(true)}
                  className="px-8 py-3.5 rounded-2xl bg-[#c05634] text-white text-base font-semibold hover:bg-[#a94829] shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
                >
                  + Upload your first file
                </button>
              </div>
            ) : (
              <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                {documents.map((doc) => (
                  <DocumentGridCard
                    key={doc.id}
                    document={doc}
                    isSelected={selectedDoc?.id === doc.id}
                    onSelect={() => setSelectedDoc(doc)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Document Detail Pane (Right Column) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-28">
            <DocumentDetailPane
              document={selectedDoc}
              onDelete={handleDelete}
              busyDeleting={busyDeleting}
            />
          </div>
        </div>

        {/* Bottom Disclaimer */}
        <p className="text-sm text-[#8c7b70] text-center pt-8 border-t border-[#ded5c7]">
          🔒 Anonymous print jobs do not appear in this library. Stored documents remain private to your account.
        </p>
      </main>

      <WorkspaceUploadModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadDocuments}
      />
    </div>
  );
}
