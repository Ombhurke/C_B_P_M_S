import { ArrowDown, ArrowRight, FileText, Printer, QrCode, SlidersHorizontal } from 'lucide-react';

const STEPS = [
  { number: '01', title: 'Choose your counter.', description: 'Open your preferred shop from the website. Its print portal and available options are ready in your browser.', label: 'No app to install', icon: QrCode, className: 'landing-step-scan' },
  { number: '02', title: 'Make it your print.', description: 'Upload a PDF or image. Choose your print settings, review the price, and prepare your job for checkout.', label: 'Your settings. Upfront pricing.', icon: SlidersHorizontal, className: 'landing-step-configure' },
  { number: '03', title: 'Leave with paper.', description: 'Show your release PIN or barcode to the shop operator, who sends your job to the printer.', label: 'A code. A counter. A print.', icon: Printer, className: 'landing-step-collect' },
];

export default function WorkflowSteps() {
  return (
    <section id="workflow-section" className="landing-section landing-workflow" aria-labelledby="workflow-title">
      <div className="landing-shell landing-section-content">
        <div className="landing-heading-row" data-reveal>
          <div>
            <p className="landing-eyebrow">Small steps. Fresh pages.</p>
            <h2 id="workflow-title">From your screen.<br /><em>To your hands.</em></h2>
          </div>
          <p className="landing-section-description">
            No attachments lost in a chat. No app standing in the way.
            Just a straightforward print flow.
          </p>
        </div>
        <ol className="landing-steps">
          {STEPS.map(({ number, title, description, label, icon: Icon, className }) => (
            <li key={number} className={`landing-step-card ${className}`} data-reveal>
              <div className="landing-card-top"><span className="landing-step-number">{number}</span><Icon size={30} strokeWidth={1.5} aria-hidden="true" /></div>
              <div className="landing-step-art" aria-hidden="true">
                {number === '01' && (
                  <div className="landing-mini-browser">
                    <div className="landing-browser-bar"><i /><i /><i /></div>
                    <div className="landing-browser-shop"><Printer size={28} strokeWidth={1.5} /><span>Your print counter</span><ArrowUpRightIcon /></div>
                  </div>
                )}
                {number === '02' && (
                  <div className="landing-mini-settings">
                    <div><FileText size={18} /><span>Your document</span></div>
                    <div><span>Copies</span><span className="landing-setting-value">− &nbsp; 02 &nbsp; +</span></div>
                    <div><span>Paper</span><span className="landing-setting-value">A4</span></div>
                  </div>
                )}
                {number === '03' && (
                  <div className="landing-mini-receipt"><Printer size={26} strokeWidth={1.5} /><span>Your next print,<br />ready to release.</span><div className="landing-receipt-bars" /></div>
                )}
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
              <div className="landing-step-footer"><span>{label}</span><ArrowRight size={20} aria-hidden="true" /></div>
            </li>
          ))}
        </ol>
      </div>
      <div className="landing-section-bottom landing-shell">
        <a href="#privacy-section" className="landing-text-link">Made for your privacy <ArrowDown size={18} aria-hidden="true" /></a>
        <span className="landing-section-index">02 <span>/ 04</span></span>
      </div>
    </section>
  );
}

function ArrowUpRightIcon() {
  return <ArrowRight size={16} className="landing-browser-arrow" />;
}
