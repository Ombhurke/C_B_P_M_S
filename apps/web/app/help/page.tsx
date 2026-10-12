'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  FileText,
  Lock,
  CreditCard,
  ChevronDown,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';

export default function HelpPage() {
  const { session } = useCustomerAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      q: 'Which files can I upload?',
      a: 'PDF, PNG and JPEG files up to 25 MB. The server checks every upload to verify file format, page counts, and integrity before print staging.',
    },
    {
      q: 'What is an anonymous job?',
      a: 'Anonymous jobs are designed for walk-in counter customers. Temporary files expire automatically and are deleted after printing or retention window. They never enter a saved library.',
    },
    {
      q: 'Who can see my saved documents?',
      a: 'Only your account. Library files uploaded to your account are strictly private to your customer ID. Partner print shops only receive temporary job access for specific print requests you assign to them.',
    },
    {
      q: 'Why can’t I pay yet?',
      a: 'Online checkout is not connected yet. A live payment provider must be connected before payment and print release are enabled. No money has been taken for any pending requests.',
    },
    {
      q: 'How do I delete a saved file?',
      a: 'You can delete any saved document directly from your My prints library. Deleting a document immediately and permanently purges it from cloud storage.',
    },
  ];

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="help" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-8 sm:py-12 space-y-10">
        <div>
          <Link
            href={session ? '/account' : '/'}
            className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#66554b] hover:text-[#241814] transition-colors mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{session ? 'Return to workspace' : 'Return to home'}</span>
          </Link>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-serif text-[#241814] font-normal tracking-tight">
            A little help, when you need it.
          </h1>
          <p className="text-base sm:text-lg text-[#66554b] mt-1">
            Clear answers for your documents and print jobs.
          </p>
        </div>

        {/* 3 Full-Width Top Service Cards (Visual 08) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <FileText className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-bold text-[#241814]">
              Uploading files
            </h3>
            <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
              PDF, PNG and JPEG files up to 25 MB. Every upload is inspected on the server for page counts and file safety.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-bold text-[#241814]">
              Document privacy
            </h3>
            <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
              Files uploaded to your account are private to you. Anonymous walk-in jobs are temporary and purged after printing.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3 text-left">
            <div className="w-12 h-12 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-serif font-bold text-[#241814]">
              Printing &amp; payment
            </h3>
            <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
              Choose a print shop when available. Online checkout is not connected yet.
            </p>
          </div>
        </div>

        {/* Two-Column Split: Left = FAQ, Right = Assurance cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: FAQ Accordion (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-4 text-left">
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814] mb-4">
              Frequently asked questions
            </h2>

            <div className="space-y-3">
              {faqs.map((faq, idx) => {
                const isOpen = openFaq === idx;
                return (
                  <div
                    key={faq.q}
                    className="border border-[#e6dfd5] rounded-2xl overflow-hidden bg-[#faf6f0] transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(isOpen ? null : idx)}
                      className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left font-bold text-sm sm:text-base text-[#241814] cursor-pointer"
                      aria-expanded={isOpen}
                    >
                      <span>{faq.q}</span>
                      <ChevronDown className={`w-5 h-5 text-[#8c7b70] transition-transform ${isOpen ? 'rotate-180 text-[#c05634]' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="px-4 sm:px-5 pb-5 pt-1 text-xs sm:text-sm text-[#66554b] leading-relaxed border-t border-[#e6dfd5]/60 bg-white">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Cards (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6 text-left">
            <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-[#241814]">
                <ShieldCheck className="w-5 h-5 text-[#c05634]" />
                <h3 className="text-base sm:text-lg font-serif font-bold">
                  Your document stays yours.
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
                Only your selected shop can access an assigned print job. Library documents are private to your account.
              </p>
            </div>

            <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5 text-[#8c4320]">
                <AlertCircle className="w-5 h-5 text-[#c05634]" />
                <h3 className="text-base sm:text-lg font-serif font-bold">
                  Checkout availability
                </h3>
              </div>
              <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
                Live payments are not connected yet. No money has been taken for any staged requests.
              </p>
              <div className="pt-2">
                <Link
                  href={session ? '/account' : '/shops'}
                  className="w-full inline-flex items-center justify-center px-6 py-3 min-h-[48px] rounded-xl bg-[#c05634] hover:bg-[#a94829] text-white text-sm font-semibold transition-all shadow-md shadow-[#c05634]/20"
                >
                  {session ? 'Back to workspace' : 'Find a shop'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
