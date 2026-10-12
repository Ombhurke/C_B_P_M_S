'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { User, ChevronDown, LogOut } from 'lucide-react';
import { useCustomerAuth } from '../CustomerAuthContext';

interface CustomerWorkspaceHeaderProps {
  currentTab?: 'overview' | 'documents' | 'jobs' | 'shops' | 'settings' | 'help';
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
    (pathname.startsWith('/shops') || pathname.startsWith('/shop') || pathname.startsWith('/account/print')) ? 'shops' :
    pathname.startsWith('/account/settings') ? 'settings' :
    pathname.startsWith('/help') ? 'help' : undefined
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
      // Handled via session reload
    }
  };

  const homeHref = session ? '/account' : '/';

  return (
    <header className="w-full bg-[#231713] text-[#f7f4ee] border-b border-black/30 sticky top-0 z-40 shadow-sm">
      <div className="w-full px-[clamp(24px,3.2vw,88px)] flex items-center justify-between h-20 sm:h-22">
        {/* Brand Logo & Navigation */}
        <div className="flex items-center gap-8 lg:gap-14 h-full">
          <Link
            href={homeHref}
            className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-[#f7f4ee] hover:text-white transition-colors flex items-center gap-1"
          >
            <span>CBPMS</span>
            <span className="text-[#c05634]">.</span>
          </Link>

          <nav className="flex items-center gap-6 sm:gap-9 h-full" aria-label="Customer navigation">
            {session ? (
              <>
                <Link
                  href="/account"
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
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
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
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
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
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
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
                    active === 'shops' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
                  }`}
                >
                  Find a shop
                  {active === 'shops' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
                  )}
                </Link>

                <Link
                  href="/help"
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
                    active === 'help' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
                  }`}
                >
                  Help
                  {active === 'help' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
                  )}
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/"
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
                    pathname === '/' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
                  }`}
                >
                  Home
                  {pathname === '/' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
                  )}
                </Link>

                <Link
                  href="/shops"
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
                    active === 'shops' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
                  }`}
                >
                  Find a shop
                  {active === 'shops' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
                  )}
                </Link>

                <Link
                  href="/help"
                  className={`h-full inline-flex items-center text-base sm:text-[17px] font-medium tracking-wide transition-colors relative ${
                    active === 'help' ? 'text-white' : 'text-[#d4c8bd] hover:text-white'
                  }`}
                >
                  Help
                  {active === 'help' && (
                    <span className="absolute bottom-0 left-0 right-0 h-[4px] bg-[#c05634] rounded-t-sm" />
                  )}
                </Link>
              </>
            )}
          </nav>
        </div>

        {/* Right Navigation Controls */}
        <div className="flex items-center gap-4">
          {session ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-3 px-4 py-2.5 min-h-[48px] rounded-2xl text-sm sm:text-base text-[#f7f4ee] hover:bg-white/10 transition-colors cursor-pointer border border-white/10"
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <div className="w-9 h-9 rounded-full border border-white/25 flex items-center justify-center bg-white/10 flex-shrink-0">
                  <User className="w-5 h-5 text-[#f7f4ee]" />
                </div>
                <span className="hidden sm:inline font-medium truncate max-w-[150px]">
                  {session.user.alias || 'Account'}
                </span>
                <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-3 w-72 rounded-2xl bg-[#2a1d18] border border-white/15 shadow-2xl p-2.5 z-50 text-left">
                  <div className="px-4 py-3 border-b border-white/10 mb-1.5">
                    <p className="text-xs text-neutral-400">Signed in as</p>
                    <p className="text-base font-semibold text-white truncate">
                      {session.user.alias || session.user.username || 'Customer'}
                    </p>
                    {session.user.username && (
                      <p className="text-xs text-neutral-400 truncate mt-0.5">{session.user.username}</p>
                    )}
                    <span className="inline-block mt-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded bg-[#c05634]/20 text-[#ea7c50] uppercase tracking-wider">
                      {session.user.provider === 'google' ? 'Google Account' : 'Private Cloud Workspace'}
                    </span>
                  </div>

                  <Link
                    href="/account/settings"
                    onClick={() => setDropdownOpen(false)}
                    className="w-full text-left px-4 py-3 rounded-xl text-sm text-[#f7f4ee] hover:bg-white/10 transition-colors block"
                  >
                    Settings &amp; privacy
                  </Link>

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
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-6 min-h-[48px] rounded-2xl bg-[#c05634] hover:bg-[#a94829] text-white text-base font-semibold shadow-md shadow-[#c05634]/20 transition-all cursor-pointer"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
