'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Shop, PrintConfig, CostCalculation, StagedJobResponse, PaymentSuccessResponse, AccessMode } from '@/lib/types';
import { fetchShop, calculateCost, stagePrintJob, createPaymentOrder, PaymentOrder } from '@/lib/api';
import UploadBox from '@/components/customer/UploadBox';
import PrintConfigSelector from '@/components/customer/PrintConfigSelector';
import PriceSummaryCard from '@/components/customer/PriceSummaryCard';
import PaymentModal from '@/components/customer/PaymentModal';
import ReleaseTokenCard from '@/components/customer/ReleaseTokenCard';
import ShopBanner from '@/components/customer/ShopBanner';
import ShopPrivacySelector from '../../../components/customer/ShopPrivacySelector';
import { useCustomerAuth } from '../../../components/customer/CustomerAuthContext';
import { ShieldCheck, Printer, Zap } from 'lucide-react';

export default function ShopCustomerPortal() {
  const params = useParams();
  const shopId = params?.shop_id as string;
  const { session } = useCustomerAuth();

  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(true);

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
    paperType: 'normal'
  });

  const [costCalc, setCostCalc] = useState<CostCalculation | null>(null);
  const [stagedJob, setStagedJob] = useState<StagedJobResponse | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessResponse | null>(null);
  const [order, setOrder] = useState<PaymentOrder | null>(null);
  const [error, setError] = useState('');
  const [accessMode, setAccessMode] = useState<AccessMode>('anonymous');

  useEffect(() => {
    async function load() {
      setIsLoadingShop(true);
      try { setShop(await fetchShop(shopId)); }
      catch (err) { setError(err instanceof Error ? err.message : 'Shop unavailable'); }
      finally { setIsLoadingShop(false); }
    }
    load();
  }, [shopId]);

  useEffect(() => {
    let active = true;
    if (shop && config.file) {
      calculateCost(shop, config)
        .then(res => { if (active) setCostCalc(res); })
        .catch(() => { if (active) setCostCalc(null); });
    } else {
      setCostCalc(null);
    }
    return () => { active = false; };
  }, [shop, config]);

  const handleFileSelect = (file: File, pages: number) => {
    setConfig(prev => ({
      ...prev,
      file,
      fileName: file.name,
      fileSize: file.size,
      pageCount: pages
    }));
    setStagedJob(null);
    setOrder(null);
  };

  const handleClearFile = () => {
    setConfig(prev => ({ ...prev, file: null, fileName: '', fileSize: 0, pageCount: 1 }));
    setCostCalc(null);
    setStagedJob(null);
    setOrder(null);
  };

  const handleConfigUpdate = (updated: Partial<PrintConfig>) => {
    setConfig(prev => ({ ...prev, ...updated }));
    setStagedJob(null);
    setOrder(null);
  };

  const handleStartPayment = async () => {
    if (!shop || !config.file) return;
    setIsStaging(true);
    setError('');
    try {
      if (accessMode === 'account' && !session) throw new Error('Sign in or choose anonymous mode before continuing');
      const staged = stagedJob || await stagePrintJob(shop.id, config, accessMode);
      setStagedJob(staged);
      setConfig(prev => ({ ...prev, pageCount: staged.page_count }));
      setOrder(await createPaymentOrder(staged));
      setIsPaymentOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout could not be created');
    } finally {
      setIsStaging(false);
    }
  };

  if (isLoadingShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#ea7c50]/30 border-t-[#ea7c50] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="desktop-workspace py-8 pb-24 text-[#fbf9f5]">
      {error && (
        <p role="alert" className="bg-[#451a1a]/70 border border-[#f87171]/30 text-[#fca5a5] rounded-2xl p-4 mb-6 text-sm">
          {error}
        </p>
      )}

      {/* Full-Width Shop Header */}
      <ShopBanner shop={shop} />

      {!paymentSuccess ? (
        /* 2-Column Desktop Workstation Grid */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Upload & Configurations (8 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-6">
            <ShopPrivacySelector
              accessMode={accessMode}
              onModeChange={mode => { setAccessMode(mode); setStagedJob(null); setOrder(null); }}
              session={session}
            />

            {/* Step 1: File Upload */}
            <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-[#ea7c50]/20 text-[#ea7c50] text-xs font-bold flex items-center justify-center border border-[#ea7c50]/30">
                  1
                </span>
                <h2 className="text-base font-bold uppercase tracking-wider text-[#fbf9f5]">
                  Select or Drop Document
                </h2>
              </div>
              <UploadBox
                onFileSelect={handleFileSelect}
                onClear={handleClearFile}
                selectedFile={config.file}
                pageCount={config.pageCount}
              />
            </section>

            {/* Step 2: Print Settings */}
            <section className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/10 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-xl bg-[#ea7c50]/20 text-[#ea7c50] text-xs font-bold flex items-center justify-center border border-[#ea7c50]/30">
                  2
                </span>
                <h2 className="text-base font-bold uppercase tracking-wider text-[#fbf9f5]">
                  Configure Print Layout & Options
                </h2>
              </div>
              <PrintConfigSelector
                config={config}
                onChange={handleConfigUpdate}
                isBwSupported={shop?.supports_bw ?? true}
                isColorSupported={shop?.supports_color ?? shop?.printers.some(p => p.is_color_supported)}
                isDuplexSupported={shop?.supports_duplex ?? shop?.printers.some(p => p.is_duplex_supported)}
                supportedLayouts={shop?.supported_layouts ?? [1, 2, 4, 8]}
                paperRates={shop?.paper_rates}
              />
            </section>
          </div>

          {/* Right Column: Sticky Live Price & Order Summary (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-6 space-y-6">
            <PriceSummaryCard
              disabled={!config.file || !shop}
              calculation={costCalc}
              onProceedToPayment={handleStartPayment}
              isLoading={isStaging}
            />

            {/* Station Trust & Hardware Details */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10 space-y-3.5 text-xs text-neutral-300">
              <div className="flex items-center gap-2 font-bold text-white text-sm">
                <Printer className="w-4 h-4 text-[#ea7c50]" />
                <span>Station Hardware Status</span>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Available Printers:</span>
                  <span className="font-mono text-white font-medium">{shop?.printers.filter(p => p.status === 'online').length || 0} Online</span>
                </div>
                <div className="flex justify-between py-1 border-b border-white/5">
                  <span className="text-neutral-400">Default Paper:</span>
                  <span className="font-mono text-white font-medium">A4 (80 GSM) Standard</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-400">Release Protocol:</span>
                  <span className="font-mono text-[#34d399] font-medium">Barcode / 4-Digit PIN</span>
                </div>
              </div>
              <div className="pt-2 flex items-center gap-2 text-neutral-300 border-t border-white/5">
                <ShieldCheck className="w-4 h-4 text-[#34d399] flex-shrink-0" />
                <span>Zero permanent document retention. Shredded upon counter dispatch.</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Success Screen */
        <div className="max-w-4xl mx-auto py-6">
          <ReleaseTokenCard data={paymentSuccess} fileName={config.fileName} />
        </div>
      )}

      {/* Payment Modal */}
      {order && (
        <PaymentModal
          isOpen={isPaymentOpen}
          totalCost={order.amount_minor / 100}
          currency={order.currency}
          onClose={() => setIsPaymentOpen(false)}
        />
      )}
    </div>
  );
}
