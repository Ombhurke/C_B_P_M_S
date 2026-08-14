'use client';

import React from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Printer, Shield, Zap, Sparkles, ArrowRight, Smartphone, LayoutDashboard, QrCode, Lock } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 pb-24">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 text-sky-400 px-4 py-1.5 rounded-full text-xs font-semibold mb-4">
          <Sparkles className="w-4 h-4 text-sky-400" />
          <span>Cloud Based Print Management System (CBPMS)</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight max-w-2xl mx-auto leading-tight">
          Zero-Install, Ephemeral Cloud Printing Ecosystem
        </h1>
        <p className="text-sm sm:text-base text-slate-400 mt-4 max-w-xl mx-auto">
          Eliminate WhatsApp & email file sharing at copy shops. Scan counter QR, configure layout on mobile web, pay upfront, and scan to release.
        </p>
      </div>

      {/* Counter Simulation QR Card */}
      <div className="glass-panel-glow rounded-3xl p-6 sm:p-8 border border-sky-500/30 mb-10 shadow-2xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          <div className="text-left space-y-4">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sky-400">
              <QrCode className="w-4 h-4" />
              <span>Counter Walk-In Demo</span>
            </div>
            <h2 className="text-2xl font-bold text-white">
              Scan Counter QR Code to Start
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              In a real shop, this static QR code is placed on the front counter. Customers scan it with their phone camera to instantly load the shop's pricing and upload portal.
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href="/shop/shop-demo-1"
                className="px-5 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-sky-500/25 transition-all"
              >
                <span>Launch Hub 1 Customer Flow</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/admin/dashboard"
                className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span>Operator Dashboard</span>
              </Link>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center bg-white p-6 rounded-3xl shadow-xl">
            <QRCodeSVG
              value="http://localhost:3000/shop/shop-demo-1"
              size={180}
              level="H"
            />
            <div className="text-center mt-3">
              <div className="text-xs font-bold text-slate-900">QuickPrint Express (Hub 1)</div>
              <div className="text-[10px] text-slate-500 font-mono">app.cbpms.io/shop/shop-demo-1</div>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Pillar Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <div className="glass-panel p-5 rounded-3xl border border-slate-800 text-left">
          <div className="w-10 h-10 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
            <Shield className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Zero-PII Privacy</h3>
          <p className="text-xs text-slate-400 mt-1">
            No phone numbers, emails, or account logins. Files are shredded instantly upon print completion.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 text-left">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Payment Firewall</h3>
          <p className="text-xs text-slate-400 mt-1">
            Upfront UPI/QR checkout stops counter disputes and ensures pre-paid print spooling queues.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-3xl border border-slate-800 text-left">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-white">Sub-1.5s Release</h3>
          <p className="text-xs text-slate-400 mt-1">
            Store operators scan customer 2D barcode via USB scanner for instant spooler dispatch.
          </p>
        </div>
      </div>

      {/* Alternate Shop Hubs */}
      <div className="text-center pt-4">
        <div className="text-xs text-slate-500 mb-3">Available Demo Shop Profiles:</div>
        <div className="flex justify-center gap-3 flex-wrap">
          <Link
            href="/shop/shop-demo-1"
            className="text-xs bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white px-4 py-2 rounded-xl transition-all font-mono"
          >
            🏪 QuickPrint Express (₹2.00 B&W / ₹10.00 Color)
          </Link>
          <Link
            href="/shop/shop-demo-2"
            className="text-xs bg-slate-900/90 border border-slate-800 hover:border-sky-500/50 text-slate-300 hover:text-white px-4 py-2 rounded-xl transition-all font-mono"
          >
            🏬 City Copy Center (₹3.00 B&W / ₹12.00 Color)
          </Link>
        </div>
      </div>
    </div>
  );
}
