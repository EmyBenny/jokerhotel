import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall.ts';

interface PWAInstallButtonProps {
  variant?: 'dark' | 'light';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'dark' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  const buttonClasses =
    variant === 'dark'
      ? 'inline-flex items-center gap-2 rounded-lg border border-[#D4AF37]/40 bg-[#1B1915] px-4 py-2 text-xs font-medium text-[#F7F5F0] hover:border-[#D4AF37] transition-colors whitespace-nowrap shrink-0'
      : 'inline-flex items-center gap-2 rounded-lg border border-[#14120F]/15 bg-white px-4 py-2 text-xs font-medium text-[#14120F] hover:border-[#14120F]/35 transition-colors whitespace-nowrap shrink-0 dark:border-white/15 dark:bg-[#1E1B17] dark:text-[#F5F2EB] dark:hover:border-white/35';

  if (isInstallable) {
    return (
      <button type="button" onClick={install} className={buttonClasses}>
        <Download className="h-3.5 w-3.5 text-[#C6931C]" />
        <span>Install Mobile App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button type="button" onClick={() => setShowIOSGuide(true)} className={buttonClasses}>
          <Smartphone className="h-3.5 w-3.5 text-[#C6931C]" />
          <span>Add to Home Screen</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl border border-[#14120F]/10 bg-white p-6 text-[#14120F] shadow-xl">
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-editorial text-2xl font-semibold">Install Joker Suites App</h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Close install guide"
                  className="rounded-lg p-1.5 text-[#6E675C] hover:bg-[#F7F5F0]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <ol className="mt-4 space-y-2.5 text-sm leading-relaxed text-[#4A453D]">
                <li>1. Tap the <strong>Share</strong> icon in your Safari browser bar.</li>
                <li>2. Scroll down and select <strong>Add to Home Screen</strong>.</li>
                <li>3. Open Joker Suites from your home screen for loyalty rewards and booking alerts.</li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-lg bg-[#14120F] py-2.5 text-xs font-medium text-white hover:bg-[#2A2620]"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setShowIOSGuide(true)}
      className={buttonClasses}
    >
      <Smartphone className="h-3.5 w-3.5 text-[#C6931C]" />
      <span>Mobile PWA Ready</span>
      {showIOSGuide && (
        <span className="sr-only">Open mobile installation instructions</span>
      )}
    </button>
  );
};
