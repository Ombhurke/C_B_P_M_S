'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowUpRight, MapPin, Printer, QrCode } from 'lucide-react';

export default function CounterQrCard({ shopUrl }: { shopUrl: string }) {
  return (
    <div className="landing-counter-layout">
      <div className="landing-counter-copy" data-reveal>
        <p className="landing-eyebrow">Meet your next print</p>
        <h2 id="start-title">Less waiting.<br /><em>More doing.</em></h2>
        <p className="landing-lead">
          Your next print starts in your browser. Find a participating counter,
          check its rates, and upload your document.
        </p>
        <div className="landing-shop-list" aria-label="Find print shops">
          <Link href="/shops" className="landing-shop-link">
            <span className="landing-shop-icon"><MapPin size={25} aria-hidden="true" /></span>
            <span><strong>Explore available counters</strong><small>Shop-specific rates and private uploads</small></span>
            <ArrowUpRight size={26} aria-hidden="true" />
          </Link>
        </div>
        <p className="landing-demo-note">Online payments will be available once a live payment provider is connected.</p>
      </div>
      <div className="landing-qr-scene" data-reveal>
        <div className="landing-qr-orbit" aria-hidden="true" />
        <div className="landing-qr-card">
          <div className="landing-qr-brand">
            <Printer size={26} aria-hidden="true" /><span>CBPMS<span>.</span></span>
            <span className="landing-qr-station">Find a counter</span>
          </div>
          <div><h3>Your next print<br />starts here.</h3><p>Choose your printing shop</p></div>
          <div className="landing-qr-code" role="img" aria-label="QR link to the CBPMS shop directory">
            <QRCodeSVG value={shopUrl} size={220} level="H" includeMargin fgColor="#241b16" bgColor="#ffffff" />
          </div>
          <p className="landing-qr-caption"><QrCode size={20} aria-hidden="true" /> Your counter, one scan away.</p>
          <Link href="/shops" className="landing-qr-fallback">Or browse the counters <ArrowUpRight size={18} aria-hidden="true" /></Link>
        </div>
      </div>
    </div>
  );
}
