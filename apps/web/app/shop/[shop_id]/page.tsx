'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Shop,
  PrintConfig,
  CostCalculation,
  AccessMode,
  CustomerDocument,
  PaymentSuccessResponse,
} from '@/lib/types';
import {
  fetchShop,
  calculateCost,
  calculateClientCost,
  fetchCustomerDocument,
  stagePrintJob,
  createPaymentOrder,
  verifyPayment,
  payAtCounter,
} from '@/lib/api';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import UploadBox from '@/components/customer/UploadBox';
import PrintConfigSelector from '@/components/customer/PrintConfigSelector';
import ShopPrivacySelector from '@/components/customer/ShopPrivacySelector';
import ReleaseTokenCard from '@/components/customer/ReleaseTokenCard';
import TurnstileWidget from '@/components/customer/TurnstileWidget';
import {
  ArrowLeft,
  FileText,
  Shield,
  Clock,
  AlertCircle,
  FolderLock,
  ChevronRight,
  Info,
  CheckCircle2,
  Store,
  CreditCard,
  Banknote,
  Loader2,
  Lock,
} from 'lucide-react';

function ensureRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);
  return new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      if ((window as any).Razorpay) {
        resolve(true);
        return;
      }
      existing.addEventListener('load', () => resolve(true));
      existing.addEventListener('error', () => resolve(false));
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function ShopCustomerContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const shopId = (params?.shop_id as string) || '';
  const docId = searchParams.get('doc');
  const { session } = useCustomerAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(true);
  const [shopError, setShopError] = useState('');

  // 3 Steps: 1 = Upload, 2 = Configure, 3 = Review
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accessMode, setAccessMode] = useState<AccessMode>('anonymous');
  const [selectedLibraryDoc, setSelectedLibraryDoc] = useState<CustomerDocument | null>(null);

  const [completedReceipt, setCompletedReceipt] = useState<PaymentSuccessResponse | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'razorpay' | 'counter'>('razorpay');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  const handleCaptchaVerify = React.useCallback((token: string) => {
    setCaptchaToken(token);
    setPaymentError(null);
  }, []);

  const [config, setConfig] = useState<PrintConfig>({
    file: null,
    fileName: '',
    fileSize: 0,
    pageCount: 1,
    copyCount: 1,
    isColor: false,
    duplexMode: 'simplex',
    layoutNup: 1,
    pageRange: 'all',
    paperType: 'normal',
  });

  const [costCalc, setCostCalc] = useState<CostCalculation | null>(null);
  const [isCalculatingQuote, setIsCalculatingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // Local object URL for instant preview
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Preload Razorpay checkout script
  useEffect(() => {
    void ensureRazorpayScript();
  }, []);

  // Load shop details
  useEffect(() => {
    async function loadShop() {
      setIsLoadingShop(true);
      setShopError('');
      try {
        const loaded = await fetchShop(shopId);
        setShop(loaded);
      } catch (err) {
        setShopError(err instanceof Error ? err.message : 'Print counter is currently unavailable');
      } finally {
        setIsLoadingShop(false);
      }
    }
    if (shopId) void loadShop();
  }, [shopId]);

  // Load document from library if ?doc=<id> provided
  useEffect(() => {
    async function loadDoc() {
      if (!docId) return;
      try {
        const doc = await fetchCustomerDocument(docId);
        setSelectedLibraryDoc(doc);
        setAccessMode('account');
        try {
          const downloadRes = await fetch(`/api/backend/customer/documents/${doc.id}/download`, {
            credentials: 'same-origin',
          });
          if (downloadRes.ok) {
            const blob = await downloadRes.blob();
            const file = new File([blob], doc.file_name, { type: doc.mime_type || 'application/pdf' });
            setConfig((prev) => ({
              ...prev,
              file,
              fileName: doc.file_name,
              fileSize: doc.file_size_bytes,
              pageCount: doc.page_count || 1,
            }));
            return;
          }
        } catch {}
        setConfig((prev) => ({
          ...prev,
          fileName: doc.file_name,
          fileSize: doc.file_size_bytes,
          pageCount: doc.page_count || 1,
        }));
      } catch {
        // Document missing or unauthorized, stays in blank state
      }
    }
    void loadDoc();
  }, [docId]);

  // Manage preview object URL
  useEffect(() => {
    if (config.file) {
      const url = URL.createObjectURL(config.file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [config.file]);

  // Instant client-side quote calculation (0ms latency, zero server compute on option changes)
  useEffect(() => {
    if (shop && (config.file || selectedLibraryDoc) && config.pageCount > 0) {
      try {
        const quote = calculateClientCost(shop, config);
        setCostCalc(quote);
        setQuoteError('');
      } catch (err) {
        setCostCalc(null);
        setQuoteError(err instanceof Error ? err.message : 'Could not calculate quote');
      }
    } else {
      setCostCalc(null);
      setQuoteError('');
    }
    setIsCalculatingQuote(false);
  }, [shop, config, selectedLibraryDoc]);

  const handleFileSelect = (
    file: File,
    pages: number,
    folderFiles?: File[],
    isFolder?: boolean,
    folderName?: string
  ) => {
    setSelectedLibraryDoc(null);
    setConfig((prev) => ({
      ...prev,
      file,
      fileName: isFolder && folderName ? `${folderName}.pdf` : file.name,
      fileSize: folderFiles ? folderFiles.reduce((acc, f) => acc + f.size, 0) : file.size,
      pageCount: pages,
      folderFiles: folderFiles || (isFolder ? [file] : undefined),
      isFolder: Boolean(isFolder),
    }));
  };

  const handleClearFile = () => {
    setSelectedLibraryDoc(null);
    setConfig((prev) => ({
      ...prev,
      file: null,
      fileName: '',
      fileSize: 0,
      pageCount: 1,
      folderFiles: undefined,
      isFolder: false,
    }));
    setCostCalc(null);
    setCompletedReceipt(null);
    setPaymentError(null);
    setStep(1);
  };

  const handleOnlinePayment = async () => {
    if (!shop || !config.file || isProcessingPayment) return;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const staged = await stagePrintJob(shop.id, config, accessMode, undefined, costCalc?.total_cost, captchaToken || undefined);
      const order = await createPaymentOrder(staged);

      if (order.provider !== 'razorpay' || !order.key_id) {
        throw new Error('Online payments are not configured. Please use Pay at Counter.');
      }

      const ready = await ensureRazorpayScript();
      if (!ready || typeof (window as any).Razorpay === 'undefined') {
        throw new Error('Razorpay checkout could not be loaded. Please check your internet connection or use Pay at Counter.');
      }

      const options = {
        key: order.key_id,
        amount: order.amount_minor,
        currency: order.currency,
        name: shop.name,
        description: `Print: ${config.fileName} (${config.pageCount} pgs)`,
        order_id: order.id,
        prefill: {
          name: session?.user?.alias || session?.user?.username || '',
          email: session?.user?.username || '',
        },
        theme: {
          color: '#c05634',
        },
        modal: {
          ondismiss: () => {
            setIsProcessingPayment(false);
          },
        },
        handler: async (resp: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          try {
            const receipt = await verifyPayment(staged, {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
            });
            setCompletedReceipt(receipt);
          } catch (err) {
            setPaymentError(err instanceof Error ? err.message : 'Payment verification failed');
          } finally {
            setIsProcessingPayment(false);
          }
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setPaymentError(resp.error?.description || 'Payment was cancelled or unsuccessful');
        setIsProcessingPayment(false);
      });
      rzp.open();
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Could not initialize online checkout');
      setIsProcessingPayment(false);
    }
  };

  const handlePayAtCounter = async () => {
    if (!shop || !config.file || isProcessingPayment) return;
    setIsProcessingPayment(true);
    setPaymentError(null);

    try {
      const staged = await stagePrintJob(shop.id, config, accessMode, undefined, costCalc?.total_cost, captchaToken || undefined);
      const receipt = await payAtCounter(staged);
      setCompletedReceipt(receipt);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Failed to generate pickup code');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleConfigUpdate = (updated: Partial<PrintConfig>) => {
    setConfig((prev) => ({ ...prev, ...updated }));
  };

  const hasDocument = Boolean(config.file || selectedLibraryDoc);

  if (isLoadingShop) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-base text-[#66554b]" role="status">
        Connecting to print counter…
      </main>
    );
  }

  if (shopError || !shop) {
    return (
      <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
        <CustomerWorkspaceHeader currentTab="shops" />
        <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-serif font-bold text-[#241814] mb-2">Shop unavailable</h1>
          <p className="text-base text-[#66554b] max-w-md mb-6">
            {shopError || 'This print shop could not be found or is not accepting new print jobs.'}
          </p>
          <Link
            href="/shops"
            className="px-6 py-3 rounded-xl bg-[#c05634] text-white font-semibold shadow-md shadow-[#c05634]/20 hover:bg-[#a94829] transition-all"
          >
            Find another shop
          </Link>
        </main>
      </div>
    );
  }

  const onlinePrinters = shop.printers?.filter((p) => p.status === 'online').length || 0;

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="shops" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-8 sm:py-12 space-y-8">
        {/* Breadcrumb & Header Row */}
        <div>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-[#8c7b70] mb-3">
            <Link href="/shops" className="hover:text-[#241814] transition-colors">
              Find a shop
            </Link>
            <span>/</span>
            <span className="text-[#241814] font-medium truncate max-w-xs">{shop.name}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-serif font-normal text-[#241814] tracking-tight">
                {completedReceipt ? 'Print Job Queued' : step === 1 ? 'Print at your chosen counter.' : step === 2 ? 'Configure your print.' : 'Review your print job.'}
              </h1>
              <p className="text-base sm:text-lg text-[#66554b] mt-1">
                {completedReceipt
                  ? 'Your document is queued and ready for counter collection.'
                  : step === 1
                  ? 'Upload a document, choose how it is stored, then configure your print.'
                  : step === 2
                  ? 'Adjust page layout, copies, and sides before reviewing total.'
                  : 'Verify document specifications and pricing before placing your order.'}
              </p>
            </div>

            {/* Shop Identification Card */}
            <div className="p-4 rounded-2xl bg-white border border-[#e6dfd5] shadow-xs flex items-center gap-4 text-left">
              <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] flex-shrink-0">
                <Store className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-[#241814] text-sm truncate">{shop.name}</p>
                <p className="text-xs text-[#8c7b70] truncate">{shop.address || 'Campus counter'}</p>
                <div className="mt-1">
                  {onlinePrinters > 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                      <span>{onlinePrinters} {onlinePrinters === 1 ? 'printer' : 'printers'} online</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8c7b70] bg-[#faf6f0] px-2 py-0.5 rounded-full border border-[#e6dfd5]">
                      <span>Availability not confirmed</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3 Horizontal Steps Navigation */}
        {!completedReceipt && (
          <div className="border-b border-[#e6dfd5] pb-4">
          <ol className="flex items-center gap-3 sm:gap-6 text-sm sm:text-base font-semibold">
            <li className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 pb-1 border-b-2 transition-all cursor-pointer ${
                  step === 1
                    ? 'border-[#c05634] text-[#c05634]'
                    : 'border-transparent text-[#66554b] hover:text-[#241814]'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 1 ? 'bg-[#c05634] text-white' : 'bg-[#e6dfd5] text-[#241814]'
                }`}>
                  1
                </span>
                <span>Upload</span>
              </button>
              <ChevronRight className="w-4 h-4 text-[#8c7b70] hidden sm:block" />
            </li>

            <li className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasDocument}
                onClick={() => hasDocument && setStep(2)}
                className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                  step === 2
                    ? 'border-[#c05634] text-[#c05634]'
                    : hasDocument
                    ? 'border-transparent text-[#66554b] hover:text-[#241814] cursor-pointer'
                    : 'border-transparent text-[#a8998e] cursor-not-allowed'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 2 ? 'bg-[#c05634] text-white' : 'bg-[#e6dfd5] text-[#241814]'
                }`}>
                  2
                </span>
                <span>Configure</span>
              </button>
              <ChevronRight className="w-4 h-4 text-[#8c7b70] hidden sm:block" />
            </li>

            <li className="flex items-center gap-2">
              <button
                type="button"
                disabled={!hasDocument}
                onClick={() => hasDocument && setStep(3)}
                className={`flex items-center gap-2 pb-1 border-b-2 transition-all ${
                  step === 3
                    ? 'border-[#c05634] text-[#c05634]'
                    : hasDocument
                    ? 'border-transparent text-[#66554b] hover:text-[#241814] cursor-pointer'
                    : 'border-transparent text-[#a8998e] cursor-not-allowed'
                }`}
              >
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === 3 ? 'bg-[#c05634] text-white' : 'bg-[#e6dfd5] text-[#241814]'
                }`}>
                  3
                </span>
                <span>Review</span>
              </button>
            </li>
          </ol>
        </div>
        )}

        {completedReceipt ? (
          <div className="py-6">
            <ReleaseTokenCard
              data={completedReceipt}
              fileName={config.fileName}
              shopName={shop.name}
              onReset={handleClearFile}
            />
          </div>
        ) : (
          <>
            {/* STEP 1: UPLOAD & PRIVACY */}
            {step === 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Privacy + Upload Panel (8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              <ShopPrivacySelector
                accessMode={accessMode}
                onModeChange={(mode) => setAccessMode(mode)}
                session={session}
                shopId={shop.id}
              />

              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 space-y-6 shadow-sm text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                      Select document
                    </h2>
                    <p className="text-sm text-[#66554b] mt-0.5">
                      Upload a PDF or image file from your device.
                    </p>
                  </div>
                  {session && (
                    <Link
                      href={`/account/print/new?doc=${selectedLibraryDoc?.id || ''}`}
                      className="text-xs sm:text-sm font-semibold text-[#c05634] hover:underline"
                    >
                      Use a saved document →
                    </Link>
                  )}
                </div>

                {selectedLibraryDoc ? (
                  <div className="bg-[#faf6f0] border border-[#e6dfd5] rounded-2xl p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white border border-[#ded5c7] flex items-center justify-center text-[#c05634]">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-[#8c7b70] uppercase tracking-wider">From your library</span>
                        <p className="font-bold text-[#241814] text-base">{selectedLibraryDoc.file_name}</p>
                        <p className="text-xs text-[#66554b]">
                          {selectedLibraryDoc.page_count} pages · {(selectedLibraryDoc.file_size_bytes / (1024 * 1024)).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleClearFile}
                      className="text-xs text-red-700 hover:underline font-semibold cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                ) : (
                  <UploadBox
                    onFileSelect={handleFileSelect}
                    onClear={handleClearFile}
                    selectedFile={config.file}
                    pageCount={config.pageCount}
                    isFolder={config.isFolder}
                    folderFiles={config.folderFiles}
                    folderName={config.fileName}
                  />
                )}

                {hasDocument && (
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all flex items-center gap-2 cursor-pointer"
                    >
                      <span>Configure print options</span>
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Information & Summary (4 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-4 text-left">
                <h3 className="text-lg font-serif font-bold text-[#241814]">
                  Before you print
                </h3>
                <ul className="space-y-3 text-sm text-[#66554b]">
                  <li className="flex items-start gap-2.5">
                    <Shield className="w-4 h-4 text-[#c05634] flex-shrink-0 mt-0.5" />
                    <span>Files are shared only with your selected shop.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-[#c05634] flex-shrink-0 mt-0.5" />
                    <span>Anonymous files expire or are removed after printing.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <FolderLock className="w-4 h-4 text-[#c05634] flex-shrink-0 mt-0.5" />
                    <span>Saved library files stay until you delete them.</span>
                  </li>
                </ul>
              </div>

              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-4 text-left">
                <h3 className="text-base font-bold text-[#241814] uppercase tracking-wider text-xs text-[#8c7b70]">
                  Your print summary
                </h3>
                {hasDocument ? (
                  <div className="space-y-2 text-sm text-[#241814]">
                    <p className="font-semibold">{config.fileName}</p>
                    <p className="text-xs text-[#66554b]">
                      {config.pageCount} {config.pageCount === 1 ? 'page' : 'pages'} estimated · Verified by server
                    </p>
                    <p className="text-xs text-[#8c7b70] pt-2 border-t border-[#f4eee6]">
                      Proceed to configuration to choose sides, color, and paper type.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-[#66554b] leading-relaxed">
                    Upload a file to see available options and a quote.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: CONFIGURE PRINT */}
        {step === 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Document Viewer (7 cols) */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-4">
              <div className="bg-white rounded-3xl border border-[#e6dfd5] overflow-hidden shadow-xs text-left">
                {/* Viewer Toolbar */}
                <div className="px-6 py-4 bg-[#faf6f0] border-b border-[#e6dfd5] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText className="w-5 h-5 text-[#c05634] flex-shrink-0" />
                    <span className="font-bold text-sm sm:text-base text-[#241814] truncate">{config.fileName}</span>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-[#8c7b70] flex-shrink-0">
                    Page 1 of {config.pageCount}
                  </span>
                </div>

                {/* Preview Canvas */}
                <div className="p-6 bg-[#ede8de] min-h-[460px] flex items-center justify-center">
                  {selectedLibraryDoc ? (
                    <iframe
                      src={`/api/backend/customer/documents/${encodeURIComponent(selectedLibraryDoc.id)}/download`}
                      className="w-full h-[520px] rounded-2xl bg-white shadow-md border border-[#ded5c7]"
                      title={selectedLibraryDoc.file_name}
                    />
                  ) : previewUrl && config.file?.type.startsWith('image/') ? (
                    <img
                      src={previewUrl}
                      alt={config.fileName}
                      className="max-h-[520px] max-w-full rounded-2xl shadow-md border border-[#ded5c7] object-contain"
                    />
                  ) : previewUrl && config.file?.type === 'application/pdf' ? (
                    <iframe
                      src={previewUrl}
                      className="w-full h-[520px] rounded-2xl bg-white shadow-md border border-[#ded5c7]"
                      title={config.fileName}
                    />
                  ) : (
                    <div className="w-72 h-96 bg-white rounded-2xl border border-[#ded5c7] shadow-lg p-6 flex flex-col justify-between text-left">
                      <div className="space-y-3 opacity-70">
                        <div className="w-24 h-3 bg-[#a39484] rounded" />
                        <div className="w-full h-2 bg-[#d4c8bb] rounded" />
                        <div className="w-5/6 h-2 bg-[#d4c8bb] rounded" />
                        <div className="w-4/6 h-2 bg-[#d4c8bb] rounded" />
                        <div className="w-full h-2 bg-[#d4c8bb] rounded mt-4" />
                        <div className="w-3/4 h-2 bg-[#d4c8bb] rounded" />
                      </div>
                      <div className="text-center pt-4 border-t border-[#f4eee6]">
                        <p className="text-xs font-bold text-[#241814]">{config.fileName}</p>
                        <p className="text-[11px] text-[#8c7b70]">{config.pageCount} pages inspected</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Settings + Live Server Quote (5 cols) */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6">
              <PrintConfigSelector
                config={config}
                onChange={handleConfigUpdate}
                isBwSupported={shop.supports_bw ?? true}
                isColorSupported={shop.supports_color ?? shop.printers.some((p) => p.is_color_supported)}
                isDuplexSupported={shop.supports_duplex ?? shop.printers.some((p) => p.is_duplex_supported)}
                supportedLayouts={shop.supported_layouts ?? [1, 2, 4, 8]}
                paperRates={shop.paper_rates}
              />

              {/* Server Quote Card */}
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-4 text-left">
                <div className="flex items-center justify-between pb-3 border-b border-[#f4eee6]">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">Estimated total</span>
                    <p className="text-xs text-[#66554b] mt-0.5">
                      {config.pageCount} pages × {config.copyCount} {config.copyCount === 1 ? 'copy' : 'copies'}
                    </p>
                  </div>
                  <div className="text-right">
                    {isCalculatingQuote ? (
                      <span className="text-sm font-semibold text-[#8c7b70]">Calculating…</span>
                    ) : costCalc ? (
                      <span className="text-3xl font-extrabold font-mono text-[#241814]">
                        {costCalc.currency} {costCalc.total_cost.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-sm text-red-700">Quote error</span>
                    )}
                  </div>
                </div>

                {quoteError && (
                  <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                    {quoteError}
                  </p>
                )}

                <p className="text-xs text-[#8c7b70]">
                  Final amount is confirmed by the server before print release.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 min-h-[48px] rounded-2xl border-2 border-[#dcd4c8] hover:bg-neutral-50 text-[#3d2f28] text-sm font-semibold transition-colors cursor-pointer"
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    disabled={!costCalc || isCalculatingQuote}
                    onClick={() => setStep(3)}
                    className="flex-1 py-3.5 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <span>Review job</span>
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & HONEST UNAVAILABLE CHECKOUT */}
        {step === 3 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Column: Job & Shop Summary (7 cols) */}
            <div className="lg:col-span-7 xl:col-span-7 space-y-6 text-left">
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-6">
                <div className="flex items-center justify-between pb-4 border-b border-[#f4eee6]">
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                    Document &amp; print specifications
                  </h2>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-xs sm:text-sm font-semibold text-[#c05634] hover:underline cursor-pointer"
                  >
                    Edit print options
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] flex-shrink-0">
                      <FileText className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="font-bold text-lg text-[#241814]">{config.fileName}</p>
                      <p className="text-sm text-[#66554b] mt-0.5">
                        {config.pageCount} pages · {config.copyCount} {config.copyCount === 1 ? 'copy' : 'copies'} ·{' '}
                        {config.isColor ? 'Colour' : 'Black & white'} ·{' '}
                        {config.duplexMode === 'simplex' ? 'Single-sided' : 'Double-sided'}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-[#8c7b70]">Storage privacy</span>
                    <span className="font-semibold text-[#241814] capitalize">
                      {accessMode === 'anonymous' ? 'Anonymous walk-in job (temporary)' : 'Account-linked job (saved)'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-[#8c7b70]">Paper selection</span>
                    <span className="font-semibold text-[#241814]">
                      A4 · {config.paperType === 'bond' ? 'Bond Paper (Executive)' : 'Standard (75 GSM)'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Chosen Shop Card */}
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#8c7b70]">
                  Print counter destination
                </h3>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634] flex-shrink-0">
                    <Store className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-bold text-base text-[#241814]">{shop.name}</p>
                    <p className="text-sm text-[#66554b]">{shop.address || 'Campus counter'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Price Breakdown + Honest Unavailable Checkout Notice (5 cols) */}
            <div className="lg:col-span-5 xl:col-span-5 space-y-6 text-left">
              {/* Price Breakdown */}
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f4eee6]">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#8c7b70]">Print total</span>
                    <p className="text-xs text-[#66554b] mt-0.5">Confirmed by server calculation</p>
                  </div>
                  <span className="text-3xl font-extrabold font-mono text-[#241814]">
                    {costCalc ? `${costCalc.currency} ${costCalc.total_cost.toFixed(2)}` : '--'}
                  </span>
                </div>

                {costCalc && (
                  <div className="space-y-2 text-xs text-[#66554b]">
                    <div className="flex justify-between">
                      <span>Rate per page:</span>
                      <span className="font-mono font-medium">{costCalc.currency} {costCalc.rate_per_page.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total printed sheets:</span>
                      <span className="font-mono font-medium">{costCalc.total_sheets} sheets</span>
                    </div>
                    {costCalc.discount > 0 && (
                      <div className="flex justify-between text-emerald-800 font-medium">
                        <span>Duplex paper discount:</span>
                        <span className="font-mono">- {costCalc.currency} {costCalc.discount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Hybrid Checkout Card */}
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-5">
                <div>
                  <h3 className="text-base font-serif font-bold text-[#241814]">
                    Choose payment method
                  </h3>
                  <p className="text-xs text-[#66554b] mt-0.5">
                    Select instant online checkout or pay at counter on pickup.
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Option 1: Razorpay Online */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPaymentMethod('razorpay')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedPaymentMethod('razorpay');
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                      selectedPaymentMethod === 'razorpay'
                        ? 'border-[#c05634] bg-[#faf6f0]'
                        : 'border-[#e6dfd5] bg-white hover:border-[#d4c8bb]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedPaymentMethod === 'razorpay' ? 'border-[#c05634]' : 'border-[#d4c8bb]'
                          }`}
                        >
                          {selectedPaymentMethod === 'razorpay' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#c05634]" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-[#241814]">Pay Online</span>
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-[#fdf3ea] text-[#c05634]">
                            Instant Spooling
                          </span>
                        </div>
                      </div>
                      <CreditCard className="w-5 h-5 text-[#8c7b70]" />
                    </div>
                    <p className="text-xs text-[#66554b] mt-2 ml-8 leading-relaxed">
                      UPI (GPay / PhonePe / Paytm), Cards &amp; Netbanking via Razorpay.
                    </p>
                  </div>

                  {/* Option 2: Pay at Counter */}
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPaymentMethod('counter')}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setSelectedPaymentMethod('counter');
                    }}
                    className={`p-4 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                      selectedPaymentMethod === 'counter'
                        ? 'border-[#c05634] bg-[#faf6f0]'
                        : 'border-[#e6dfd5] bg-white hover:border-[#d4c8bb]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            selectedPaymentMethod === 'counter' ? 'border-[#c05634]' : 'border-[#d4c8bb]'
                          }`}
                        >
                          {selectedPaymentMethod === 'counter' && (
                            <div className="w-2.5 h-2.5 rounded-full bg-[#c05634]" />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-bold text-[#241814]">Pay at Counter</span>
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-[#66554b]">
                            Zero Fees
                          </span>
                        </div>
                      </div>
                      <Banknote className="w-5 h-5 text-[#8c7b70]" />
                    </div>
                    <p className="text-xs text-[#66554b] mt-2 ml-8 leading-relaxed">
                      Get a 4-digit release PIN instantly. Pay cash or shop UPI when collecting your print.
                    </p>
                  </div>
                </div>

                {paymentError && (
                  <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Payment Error</p>
                      <p className="mt-0.5">{paymentError}</p>
                    </div>
                  </div>
                )}

                {/* Anti-Bot Verification for Anonymous Guests */}
                {accessMode === 'anonymous' && (
                  <TurnstileWidget
                    onVerify={handleCaptchaVerify}
                    onError={() => setPaymentError('Security check failed. Please refresh and try again.')}
                    className="mb-2"
                  />
                )}

                {/* Primary Action Button */}
                <div className="space-y-3 pt-2">
                  {selectedPaymentMethod === 'razorpay' ? (
                    <button
                      type="button"
                      disabled={isProcessingPayment || !costCalc || (accessMode === 'anonymous' && !captchaToken && Boolean(process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY))}
                      onClick={handleOnlinePayment}
                      className="w-full py-4 min-h-[52px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingPayment ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Connecting to Razorpay…</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-4 h-4" />
                          <span>
                            Pay {costCalc ? `${costCalc.currency} ${costCalc.total_cost.toFixed(2)}` : ''} Online
                          </span>
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isProcessingPayment || !costCalc || (accessMode === 'anonymous' && !captchaToken && Boolean(process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY))}
                      onClick={handlePayAtCounter}
                      className="w-full py-4 min-h-[52px] rounded-2xl bg-[#241814] hover:bg-[#3d2f28] text-white text-base font-semibold shadow-md shadow-black/10 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isProcessingPayment ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Generating release PIN…</span>
                        </>
                      ) : (
                        <>
                          <Banknote className="w-4 h-4" />
                          <span>Issue PIN &amp; Pay at Counter</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="flex items-center justify-between text-xs text-[#8c7b70] pt-1">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="text-[#66554b] hover:text-[#241814] font-semibold cursor-pointer"
                    >
                      ← Back to print options
                    </button>
                    <span>2-hour expiry after issue</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ShopCustomerPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-sm">Loading…</div>}>
      <ShopCustomerContent />
    </Suspense>
  );
}
