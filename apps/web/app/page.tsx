'use client';

import './landing.css';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowDown, ArrowRight, FileText, FolderLock, LockKeyhole, ShieldCheck } from 'lucide-react';
import StatusHeader from '@/components/StatusHeader';
import WorkflowSteps from '@/components/WorkflowSteps';
import CounterQrCard from '@/components/CounterQrCard';
import { useLandingExperience } from '@/components/landing/useLandingExperience';

export default function HomePage() {
  const [shopUrl, setShopUrl] = useState('/shops');
  const activeSection = useLandingExperience();

  useEffect(() => {
    setShopUrl(window.location.origin + '/shops');
  }, []);

  return (
    <div className="landing-page">
      <a className="landing-skip-link" href="#home">Skip to content</a>
      <StatusHeader activeSection={activeSection} />
      <main id="landing-main">
        <section id="home" className="landing-section landing-hero" aria-labelledby="hero-title" tabIndex={-1}>
          <div className="landing-hero-art" aria-hidden="true">
            <Image src="/images/hero-bg.png" alt="" fill priority sizes="100vw" />
          </div>
          <div className="landing-shell landing-hero-layout">
            <div className="landing-hero-copy">
              <p className="landing-eyebrow"><span className="landing-dot" /> A simpler way from file to paper</p>
              <h1 id="hero-title">Print simply.<br />Keep it <em>private.</em></h1>
              <p className="landing-lead">
                Your documents, ready for the counter. Choose a shop, upload,
                and print from your browser. No app. No compulsory sign-up.
              </p>
              <div className="landing-actions">
                <Link href="/shops" className="landing-button landing-button-primary">
                  Start printing <ArrowRight size={22} aria-hidden="true" />
                </Link>
                <a href="#workflow-section" className="landing-button landing-button-ghost">
                  See how it works <ArrowDown size={20} aria-hidden="true" />
                </a>
              </div>
              <p className="landing-hero-note"><ShieldCheck size={19} aria-hidden="true" /> Private by choice. No compulsory sign-up.</p>
            </div>
            <div className="landing-photo-label" aria-hidden="true">
              <span>Less friction. More focus.</span>
              <span>From your screen to your hands.</span>
            </div>
          </div>
          <div className="landing-section-bottom landing-shell">
            <a href="#workflow-section" className="landing-scroll-cue">
              <span className="landing-scroll-icon"><ArrowDown size={18} aria-hidden="true" /></span>
              Scroll to discover
            </a>
            <span className="landing-section-index">01 <span>/ 04</span></span>
          </div>
        </section>

        <WorkflowSteps />

        <section id="privacy-section" className="landing-section landing-privacy" aria-labelledby="privacy-title">
          <div className="landing-shell landing-section-content">
            <div className="landing-heading-row" data-reveal>
              <div>
                <p className="landing-eyebrow">Privacy, on your terms</p>
                <h2 id="privacy-title">Your documents.<br /><em>Your choice.</em></h2>
              </div>
              <p className="landing-section-description">
                Just passing through or printing regularly? Choose how your
                files are handled, one job at a time.
              </p>
            </div>
            <div className="landing-privacy-grid">
              <article className="landing-privacy-card landing-card-paper" data-reveal>
                <div className="landing-card-top">
                  <span className="landing-icon-tile"><LockKeyhole size={26} aria-hidden="true" /></span>
                  <span className="landing-card-tag">For the one-off print</span>
                </div>
                <div className="landing-paper-illustration" aria-hidden="true">
                  <div className="landing-paper-sheet"><FileText size={28} /><span /><span /><span /></div>
                  <span className="landing-paper-seal"><ShieldCheck size={24} /></span>
                </div>
                <div>
                  <h3>Print. Collect. Move on.</h3>
                  <p>Choose anonymous mode without creating an account. Temporary files are deleted after reported spooling success or job expiry.</p>
                </div>
                <span className="landing-card-footnote">No customer library. No account required.</span>
              </article>
              <article className="landing-privacy-card landing-card-library" data-reveal>
                <div className="landing-card-top">
                  <span className="landing-icon-tile"><FolderLock size={26} aria-hidden="true" /></span>
                  <span className="landing-card-tag">For your everyday files</span>
                </div>
                <div>
                  <h3>A library.<br />Only for you.</h3>
                  <p>Keep account-linked documents in your private workspace for next time. Delete reusable files when you no longer need them.</p>
                </div>
                <Link href="/account" className="landing-text-link">Open your workspace <ArrowRight size={20} aria-hidden="true" /></Link>
              </article>
              <article className="landing-privacy-card landing-card-shop" data-reveal>
                <span className="landing-icon-tile"><ShieldCheck size={26} aria-hidden="true" /></span>
                <div>
                  <h3>One job.<br />One chosen shop.</h3>
                  <p>Your selected shop handles your submitted job. Uploads aren’t a public document gallery.</p>
                </div>
                <span className="landing-card-footnote">A release code connects you to the counter.</span>
              </article>
            </div>
          </div>
          <div className="landing-section-bottom landing-shell">
            <span>Designed around your next print.</span>
            <span className="landing-section-index">03 <span>/ 04</span></span>
          </div>
        </section>

        <section id="counter-station" className="landing-section landing-start" aria-labelledby="start-title">
          <div className="landing-shell landing-section-content"><CounterQrCard shopUrl={shopUrl} /></div>
          <footer className="landing-footer landing-shell">
            <span>CBPMS <span className="landing-footer-dot">·</span> Thoughtful printing, by design.</span>
            <div>
              <Link href="/account">Your workspace</Link>
              <Link href="/admin/dashboard">For operators <ArrowRight size={16} aria-hidden="true" /></Link>
              <a href="#home" aria-label="Back to top"><ArrowDown className="landing-arrow-up" size={20} aria-hidden="true" /></a>
            </div>
          </footer>
        </section>
      </main>
    </div>
  );
}
