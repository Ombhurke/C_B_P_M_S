'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Menu, Printer, X } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'workflow-section', label: 'How it works' },
  { id: 'privacy-section', label: 'Your privacy' },
  { id: 'counter-station', label: 'Find a counter' },
];

export default function StatusHeader({ activeSection = 'home' }: { activeSection?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        menuButton.current?.focus();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (!header.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setMenuOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, [menuOpen]);

  return (
    <header
      ref={header}
      className={`landing-header${activeSection !== 'home' ? ' is-scrolled' : ''}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setMenuOpen(false);
      }}
    >
      <div className="landing-nav-shell">
        <a href="#home" className="landing-brand" aria-label="CBPMS home" onClick={() => setMenuOpen(false)}>
          <span className="landing-brand-icon"><Printer size={28} aria-hidden="true" /></span>
          <span>CBPMS<span className="landing-brand-period">.</span><small>Cloud printing, simplified</small></span>
        </a>
        <nav className="landing-desktop-nav" aria-label="Main navigation">
          {NAV_ITEMS.map(({ id, label }) => (
            <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined}>{label}</a>
          ))}
        </nav>
        <div className="landing-nav-actions">
          <Link href="/account" className="landing-account-link">My workspace</Link>
          <Link href="/shops" className="landing-button landing-button-small">
            Try a print <ArrowUpRight size={20} aria-hidden="true" />
          </Link>
          <button
            ref={menuButton} type="button" className="landing-menu-toggle"
            aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menuOpen} aria-controls="landing-mobile-nav"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="landing-mobile-nav" className="landing-mobile-nav" aria-label="Compact navigation" hidden={!menuOpen}>
        {NAV_ITEMS.map(({ id, label }) => (
          <a key={id} href={`#${id}`} aria-current={activeSection === id ? 'location' : undefined} onClick={() => setMenuOpen(false)}>
            {label}<ArrowUpRight size={18} aria-hidden="true" />
          </a>
        ))}
        <Link href="/account" onClick={() => setMenuOpen(false)}>My workspace</Link>
        <Link href="/admin/dashboard" onClick={() => setMenuOpen(false)}>Operator dashboard</Link>
      </nav>
    </header>
  );
}
