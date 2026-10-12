'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  User,
  Shield,
  LogOut,
  HelpCircle,
  Check,
  AlertCircle,
  FolderLock,
  Lock,
} from 'lucide-react';
import { useCustomerAuth } from '@/components/customer/CustomerAuthContext';
import AccountSignedOutView from '@/components/customer/AccountSignedOutView';
import CustomerWorkspaceHeader from '@/components/customer/workspace/CustomerWorkspaceHeader';

export default function AccountSettingsPage() {
  const router = useRouter();
  const { session, loading: authLoading, updateAlias, signOut } = useCustomerAuth();

  const [activeTab, setActiveTab] = useState<'profile' | 'privacy'>('profile');
  const [alias, setAlias] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [signOutError, setSignOutError] = useState('');

  useEffect(() => {
    if (session) {
      setAlias(session.user.alias || session.user.username.slice(0, 6) || '');
    }
  }, [session]);

  if (authLoading) {
    return (
      <main className="min-h-screen bg-[#f7f4ee] flex items-center justify-center text-base text-[#66554b]" role="status">
        Loading account settings…
      </main>
    );
  }

  if (!session) {
    return <AccountSignedOutView initialMode="login" />;
  }

  const handleSaveAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = alias.trim();
    if (!clean) {
      setSaveError('Display name cannot be empty');
      return;
    }
    if (clean.length > 32) {
      setSaveError('Display name must be 32 characters or fewer');
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await updateAlias(clean);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to update display name');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setSignOutError('');
    try {
      await signOut();
      router.push('/login');
    } catch (err) {
      setSignOutError(err instanceof Error ? err.message : 'Sign out failed. Please retry.');
    }
  };

  const isGoogle = session.user.provider === 'google';

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#241814] flex flex-col">
      <CustomerWorkspaceHeader currentTab="settings" />

      <main className="flex-1 w-full px-[clamp(24px,3.2vw,88px)] py-8 sm:py-12 space-y-8 text-left">
        {/* Page Heading & Tabs */}
        <div>
          <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-serif text-[#241814] font-normal tracking-tight">
            Your account. Your choices.
          </h1>
          <p className="text-base sm:text-lg text-[#66554b] mt-1">
            Manage your display identity, view session details, and review document privacy controls.
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-6 mt-6 border-b border-[#e6dfd5]">
            <button
              type="button"
              onClick={() => setActiveTab('profile')}
              className={`pb-3 text-base sm:text-lg font-semibold transition-colors relative cursor-pointer ${
                activeTab === 'profile' ? 'text-[#c05634]' : 'text-[#66554b] hover:text-[#241814]'
              }`}
            >
              Profile
              {activeTab === 'profile' && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#c05634] rounded-t-sm" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('privacy')}
              className={`pb-3 text-base sm:text-lg font-semibold transition-colors relative cursor-pointer ${
                activeTab === 'privacy' ? 'text-[#c05634]' : 'text-[#66554b] hover:text-[#241814]'
              }`}
            >
              Privacy preferences
              {activeTab === 'privacy' && (
                <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#c05634] rounded-t-sm" />
              )}
            </button>
          </div>
        </div>

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Left Content (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8 space-y-8">
            {activeTab === 'profile' ? (
              <>
                {/* Profile Card */}
                <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                      Profile details
                    </h2>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#fdf3ea] text-[#c05634] text-xs font-semibold">
                      {isGoogle ? 'Google account' : 'Email account'}
                    </span>
                  </div>

                  {saveSuccess && (
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs sm:text-sm text-emerald-900 flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                      <span>Display name updated and saved successfully.</span>
                    </div>
                  )}

                  {saveError && (
                    <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-900 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-700 flex-shrink-0" />
                      <span>{saveError}</span>
                    </div>
                  )}

                  <form onSubmit={handleSaveAlias} className="space-y-5">
                    <div className="space-y-2">
                      <label htmlFor="display-name" className="block text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
                        Display name
                      </label>
                      <input
                        id="display-name"
                        type="text"
                        maxLength={32}
                        value={alias}
                        onChange={(e) => setAlias(e.target.value)}
                        placeholder="Your preferred name"
                        className="w-full bg-[#faf6f0] border border-[#dcd4c8] focus:border-[#c05634] text-[#241814] rounded-2xl px-4 py-3.5 text-base focus:outline-none transition-colors"
                      />
                      <p className="text-xs text-[#8c7b70]">
                        How your name appears in your private shelf and order history.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="account-email" className="block text-xs font-bold uppercase tracking-wider text-[#8c7b70]">
                        Email address
                      </label>
                      <input
                        id="account-email"
                        type="email"
                        readOnly
                        value={session.user.username}
                        className="w-full bg-[#f0eae1] border border-[#dcd4c8] text-[#66554b] rounded-2xl px-4 py-3.5 text-base cursor-not-allowed select-all"
                      />
                      <p className="text-xs text-[#8c7b70]">
                        Managed by your sign-in provider ({isGoogle ? 'Google authentication' : 'Email authentication'}).
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={saving}
                        className="px-8 py-3.5 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        <span>{saving ? 'Saving changes…' : 'Save changes'}</span>
                      </button>
                    </div>
                  </form>
                </div>

                {/* Privacy Preferences Informative Shelf */}
                <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-4">
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                    Privacy preferences
                  </h2>
                  <p className="text-sm text-[#66554b] leading-relaxed">
                    Choose document privacy separately for every print job. Privacy choices are made per job during print preparation rather than as a global override:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-[#241814]">
                        <Shield className="w-4 h-4 text-[#c05634]" />
                        <span>Anonymous jobs</span>
                      </div>
                      <p className="text-xs text-[#66554b] leading-relaxed">
                        Temporary walk-in files that expire or are shredded upon counter dispatch. Never saved in your private library.
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] space-y-2">
                      <div className="flex items-center gap-2 font-bold text-sm text-[#241814]">
                        <FolderLock className="w-4 h-4 text-[#c05634]" />
                        <span>Account-linked jobs</span>
                      </div>
                      <p className="text-xs text-[#66554b] leading-relaxed">
                        Saved in your private shelf for instant repeat printing. Strictly isolated to your account ID.
                      </p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Privacy Tab Dedicated View */
              <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-8 shadow-xs space-y-6">
                <div>
                  <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#241814]">
                    Data protection &amp; cloud storage
                  </h2>
                  <p className="text-sm text-[#66554b] mt-1 leading-relaxed">
                    How CBPMS protects your private documents, authentication credentials, and print data.
                  </p>
                </div>

                <div className="space-y-4 text-sm text-[#66554b] leading-relaxed">
                  <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] space-y-1.5">
                    <h3 className="font-bold text-[#241814] flex items-center gap-2">
                      <Lock className="w-4 h-4 text-[#c05634]" />
                      <span>Zero public document access</span>
                    </h3>
                    <p className="text-xs">
                      Documents are never stored in public buckets. Every preview and download requires verified server-side session checks.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#faf6f0] border border-[#e6dfd5] space-y-1.5">
                    <h3 className="font-bold text-[#241814] flex items-center gap-2">
                      <Shield className="w-4 h-4 text-[#c05634]" />
                      <span>Shredding upon deletion</span>
                    </h3>
                    <p className="text-xs">
                      When you delete a document from your library, the underlying cloud storage object is permanently purged.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Third: Session & Deletion (4 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 space-y-6">
            {/* Session Card */}
            <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#faf6f0] border border-[#efe7dd] flex items-center justify-center text-[#c05634]">
                  <User className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#241814]">Active session</h3>
                  <p className="text-xs text-[#8c7b70]">You are signed in on this browser.</p>
                </div>
              </div>

              {signOutError && (
                <p className="text-xs text-red-700 bg-red-50 p-2.5 rounded-xl border border-red-200">
                  {signOutError}
                </p>
              )}

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full py-3 px-5 min-h-[48px] rounded-2xl border-2 border-red-200 text-red-700 hover:bg-red-50 text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign out</span>
              </button>
            </div>

            {/* Account Deletion / Support Guidance (Visual 06) */}
            <div className="bg-white rounded-3xl border border-[#e6dfd5] p-6 sm:p-7 shadow-xs space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#8c7b70]">
                Account deletion
              </h3>
              <p className="text-xs sm:text-sm text-[#66554b] leading-relaxed">
                Contact support to request deletion until self-service deletion is available.
              </p>
              <div className="pt-2">
                <Link
                  href="/help"
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#c05634] hover:underline"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>Get help →</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
