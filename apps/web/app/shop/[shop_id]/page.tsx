'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Shop, PrintConfig, CostCalculation, StagedJobResponse, PaymentSuccessResponse } from '@/lib/types';
import { fetchShop, calculateCost, stagePrintJob, verifyPayment } from '@/lib/api';
import UploadBox from '@/components/customer/UploadBox';
import PrintConfigSelector from '@/components/customer/PrintConfigSelector';
import PriceSummaryCard from '@/components/customer/PriceSummaryCard';
import PaymentModal from '@/components/customer/PaymentModal';
import ReleaseTokenCard from '@/components/customer/ReleaseTokenCard';
import { Printer, MapPin, Phone, Shield, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ShopCustomerPortal() {
  const params = useParams();
  const shopId = (params?.shop_id as string) || 'shop-demo-1';

  const [shop, setShop] = useState<Shop | null>(null);
  const [isLoadingShop, setIsLoadingShop] = useState(true);

  const [config, setConfig] = useState<PrintConfig>({
    file: null,
    fileName: 'lecture_notes_unit3.pdf',
    fileSize: 1.4 * 1024 * 1024,
    pageCount: 6,
    copyCount: 1,
    isColor: false,
    duplexMode: 'simplex',
    layoutNup: 1,
    pageRange: 'all'
  });

  const [costCalc, setCostCalc] = useState<CostCalculation | null>(null);
  const [stagedJob, setStagedJob] = useState<StagedJobResponse | null>(null);
  const [isStaging, setIsStaging] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState<PaymentSuccessResponse | null>(null);

  // Load shop profile
  useEffect(() => {
    async function load() {
      setIsLoadingShop(true);
      const data = await fetchShop(shopId);
      setShop(data);
      setIsLoadingShop(false);
    }
    load();
  }, [shopId]);

  // Recalculate price whenever config or shop changes
  useEffect(() => {
    if (shop) {
      calculateCost(shop, config).then(setCostCalc);
    }
  }, [shop, config]);

  const handleFileSelect = (file: File, extractedPages: number) => {
    setConfig(prev => ({
      ...prev,
      file,
      fileName: file.name,
      fileSize: file.size,
      pageCount: extractedPages
    }));
  };

  const handleClearFile = () => {
    setConfig(prev => ({
      ...prev,
      file: null,
      pageCount: 1
    }));
    setStagedJob(null);
  };

  const handleConfigUpdate = (updated: Partial<PrintConfig>) => {
    setConfig(prev => ({ ...prev, ...updated }));
  };

  const handleStartPayment = async () => {
    if (!shop) return;
    setIsStaging(true);
    try {
      const staged = await stagePrintJob(shop.id, config);
      setStagedJob(staged);
      setIsPaymentOpen(true);
    } catch (err) {
      console.error(err);
    } finally {
      setIsStaging(false);
    }
  };

  const handlePaymentConfirmed = async (paymentId: string) => {
    setIsPaymentOpen(false);
    if (!stagedJob) return;
    const res = await verifyPayment(stagedJob.job_id, paymentId);
    setPaymentSuccess(res);
  };

  if (isLoadingShop) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-20">
      {/* Top Header */}
      <header className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Locations</span>
        </Link>
        <div className="flex items-center gap-1.5 text-[11px] bg-slate-900 border border-slate-800 text-sky-400 px-3 py-1 rounded-full font-mono">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>Privacy Verified</span>
        </div>
      </header>

      {/* Shop Profile Banner */}
      {shop && (
        <div className="glass-panel p-5 rounded-3xl mb-6 border border-slate-800 flex items-start justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Counter Print Station
            </div>
            <h1 className="text-xl font-bold text-white mt-0.5">{shop.name}</h1>
            <div className="flex items-center gap-4 text-xs text-slate-400 mt-2 flex-wrap">
              {shop.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" />
                  {shop.address}
                </span>
              )}
            </div>
          </div>
          <div className="text-right bg-slate-900/80 border border-slate-800 p-2.5 rounded-2xl">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Standard Rates</div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              B&W: {shop.currency} {shop.base_bw_rate.toFixed(2)}
            </div>
            <div className="text-xs font-mono font-bold text-indigo-400">
              Color: {shop.currency} {shop.base_color_rate.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Main Flow: Config vs Success Screen */}
      {!paymentSuccess ? (
        <div className="space-y-6">
          {/* Step 1: File Upload */}
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                1
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Select Document
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
          <section>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-sky-500/20 text-sky-400 text-xs font-bold flex items-center justify-center border border-sky-500/30">
                2
              </span>
              <h2 className="text-sm font-bold uppercase tracking-wider text-white">
                Configure Layout & Colors
              </h2>
            </div>
            <PrintConfigSelector
              config={config}
              onChange={handleConfigUpdate}
              isColorSupported={shop?.printers.some(p => p.is_color_supported)}
              isDuplexSupported={shop?.printers.some(p => p.is_duplex_supported)}
            />
          </section>

          {/* Step 3: Cost Calculation & Payment Trigger */}
          <section>
            <PriceSummaryCard
              calculation={costCalc}
              onProceedToPayment={handleStartPayment}
              isLoading={isStaging}
            />
          </section>
        </div>
      ) : (
        <ReleaseTokenCard data={paymentSuccess} fileName={config.fileName} />
      )}

      {/* Upfront Payment Modal */}
      {costCalc && (
        <PaymentModal
          isOpen={isPaymentOpen}
          totalCost={costCalc.total_cost}
          currency={costCalc.currency}
          onConfirm={handlePaymentConfirmed}
          onClose={() => setIsPaymentOpen(false)}
        />
      )}
    </div>
  );
}
