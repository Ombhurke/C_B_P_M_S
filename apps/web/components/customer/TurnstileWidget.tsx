'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onError?: (error: any) => void;
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'error-callback'?: (error: any) => void;
          'expired-callback'?: () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onloadTurnstileCallback?: () => void;
  }
}

export default function TurnstileWidget({
  onVerify,
  onError,
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  const siteKey = process.env.NEXT_PUBLIC_CAPTCHA_SITE_KEY;

  useEffect(() => {
    // If no site key is configured (e.g. dev/test mode without credentials), auto-verify
    if (!siteKey) {
      onVerify('mock-dev-token');
      return;
    }

    const activeKey = siteKey;
    let isMounted = true;

    function renderWidget() {
      if (!isMounted || !containerRef.current || !window.turnstile) return;
      if (widgetIdRef.current) return; // Already rendered

      try {
        const id = window.turnstile.render(containerRef.current, {
          sitekey: activeKey,
          callback: (token: string) => {
            if (isMounted) onVerify(token);
          },
          'error-callback': (err: any) => {
            if (isMounted && onError) onError(err);
          },
          theme: 'light',
          size: 'flexible',
        });
        widgetIdRef.current = id;
        setIsLoaded(true);
      } catch (err) {
        if (isMounted && onError) onError(err);
      }
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      const existingScript = document.querySelector('script[src*="turnstile/v0/api.js"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          if (isMounted) renderWidget();
        };
        script.onerror = (e) => {
          if (isMounted && onError) onError(e);
        };
        document.head.appendChild(script);
      } else {
        existingScript.addEventListener('load', () => {
          if (isMounted) renderWidget();
        });
      }
    }

    return () => {
      isMounted = false;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // ignore cleanup errors
        }
        widgetIdRef.current = null;
      }
    };
  }, [siteKey, onVerify, onError]);

  if (!siteKey) {
    return null;
  }

  return (
    <div className={`flex flex-col items-center justify-center p-3 rounded-xl bg-[#fdfbf7] border border-[#e8dfd1] text-xs text-[#66554b] ${className}`}>
      <div className="flex items-center gap-1.5 mb-2 font-medium text-[#241814]">
        <ShieldCheck className="w-4 h-4 text-[#c05634]" />
        <span>Anti-Bot Verification</span>
      </div>
      <div ref={containerRef} className="w-full flex justify-center min-h-[65px]" />
    </div>
  );
}
