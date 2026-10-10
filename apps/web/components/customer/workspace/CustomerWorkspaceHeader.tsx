'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, ChevronDown, LogOut } from 'lucide-react';
import { useCustomerAuth } from '../CustomerAuthContext';

interface CustomerWorkspaceHeaderProps {
  currentTab?: 'overview' | 'documents' | 'jobs' | 'shops';
}

export default function CustomerWorkspaceHeader({ currentTab }: CustomerWorkspaceHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useCustomerAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Determine active tab if not passed explicitly
  const active = currentTab || (
    pathname === '/account' ? 'overview' :
    pathname.startsWith('/account/documents') ? 'documents' :
    pathname.startsWith('/account/jobs') ? 'jobs' :
    pathname.startsWith('/shops') ? 'shops' : 'overview'
  );

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch {
      // Ignore
    }
  };

  return (
    <header className="w-full bg-[#231713] text-[#f7f4ee] border-b border-black/25 sticky top-0 z-40 shadow-sm">
      <div className="max-w-[1640px] 2xl:max-w-[1760px] w-full mx-auto px-6 sm:px-10 lg:px-14 xl:px-20 flex items-center justify-between h-20 sm:h-22">
        {/* Brand Logo & Main Nav */}
        <div className="flex items-center gap-10 lg:gap-16 h-full">
          <Link
            href="/account"
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f4ee] hover:text-white transition-colors"
          >
            CBPMS
          </Link>

          <nav className="flex items-center gap-7 sm:gap-10 h-full" aria-label="Customer workspace navigation">
            <Link
              href="/account"
              className={`h-full inline-flex items-center text-base sm:text-lg font-medium tracking-wide transition-colors relative ${
                active === 'overview' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
              }`}
            >
              Overview
              {active === 'overview' && (
                <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
              )}
            </Link>

            <Link
              href="/account/documents"
              className={`h-full inline-flex items-center text-base sm:text-lg font-medium tracking-wide transition-colors relative ${
                active === 'documents' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
              }`}
            >
              My prints
              {active === 'documents' && (
                <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
              )}
            </Link>

            <Link
              href="/account/jobs"
              className={`h-full inline-flex items-center text-base sm:text-lg font-medium tracking-wide transition-colors relative ${
                active === 'jobs' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
              }`}
            >
              Print jobs
              {active === 'jobs' && (
                <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
              )}
            </Link>

            <Link
              href="/shops"
              className={`h-full inline-flex items-center text-base sm:text-lg font-medium tracking-wide transition-colors relative ${
                active === 'shops' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
              }`}
            >
              Find a shop
              {active === 'shops' && (
                <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
              )}
            </Link>
          </nav>
        </div>

        {/* Account Menu on Right */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-3 px-4 py-2.5 rounded-2xl text-sm sm:text-base text-[#f7f4ee] hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
            aria-expanded={dropdownOpen}
            aria-haspopup="true"
          >
            <div className="w-9 h-9 rounded-full border border-white/25 flex items-center justify-center bg-white/10">
              <User className="w-5 h-5 text-[#f7f4ee]" />
            </div>
            <span className="hidden sm:inline font-medium truncate max-w-[140px]">{session?.user.alias || 'Account'}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-[#2a1d18] border border-white/15 shadow-2xl p-2.5 z-50 text-left">
              <div className="px-4 py-3 border-b border-white/10 mb-1.5">
                <p className="text-xs text-neutral-400">Signed in as</p>
                <p className="text-base font-semibold text-white truncate">{session?.user.alias || session?.user.username || 'Customer'}</p>
                {session?.user.alias && session?.user.username && (
                  <p className="text-xs text-neutral-400 truncate mt-0.5">{session.user.username}</p>
                )}
                <span className="inline-block mt-1 text-[11px] font-mono px-2.5 py-0.5 rounded bg-[#c05634]/20 text-[#ea7c50] uppercase tracking-wider">
                  Private Cloud Workspace
                </span>
              </div>

              <Link
                href="/account/documents"
                onClick={() => setDropdownOpen(false)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm text-[#f7f4ee] hover:bg-white/10 transition-colors block"
              >
                My saved prints
              </Link>

              <Link
                href="/account/jobs"
                onClick={() => setDropdownOpen(false)}
                className="w-full text-left px-4 py-3 rounded-xl text-sm text-[#f7f4ee] hover:bg-white/10 transition-colors block"
              >
                Print job history
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="w-full text-left px-4 py-3 rounded-xl text-sm text-red-300 hover:bg-red-500/15 transition-colors flex items-center gap-2.5 cursor-pointer mt-1"
              >
                <LogOut className="w-4 h-4 text-red-400" />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
