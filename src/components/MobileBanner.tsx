import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../constants/links';
import { useState, useEffect, useRef } from 'react';
import { useI18n } from '../context/I18nContext';
import { Smartphone } from 'lucide-react';

const MOBILE_BANNER_DISMISSED_KEY = 'mobile-banner-dismissed';

// The banner links to the store of the visitor's phone: the App Store on iPhone/iPad (but not in
// Safari there, which already shows Apple's Smart App Banner from apple-itunes-app in index.html)
// and Google Play on Android.
const storeToOffer = (): 'ios' | 'android' | null => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return 'android';
  const isIos = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
  return isIos && !isSafari ? 'ios' : null;
};

const shouldOfferApp = () => storeToOffer() !== null;

const MobileBanner = () => {
  const { t } = useI18n();
  // Check localStorage synchronously on initial render
  const dismissed = typeof window !== 'undefined' && localStorage.getItem(MOBILE_BANNER_DISMISSED_KEY) === 'true';
  const [isVisible, setIsVisible] = useState(() => {
    if (dismissed) return false;
    if (typeof window === 'undefined') return false;
    if (!shouldOfferApp()) return false;
    return window.innerWidth <= 768;
  });
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Prevent multiple checks
    if (hasCheckedRef.current) return;
    hasCheckedRef.current = true;

    // Double-check dismissal status
    const isDismissed = localStorage.getItem(MOBILE_BANNER_DISMISSED_KEY) === 'true';
    if (isDismissed || !shouldOfferApp()) {
      setIsVisible(false);
      return;
    }

    // Check if device is mobile (width <= 768px)
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      const stillDismissed = localStorage.getItem(MOBILE_BANNER_DISMISSED_KEY) === 'true';
      if (!stillDismissed) {
        setIsVisible(mobile);
      }
    };

    // Initial check
    checkMobile();

    // Check on resize (only if not dismissed)
    const handleResize = () => {
      if (localStorage.getItem(MOBILE_BANNER_DISMISSED_KEY) !== 'true') {
        checkMobile();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(MOBILE_BANNER_DISMISSED_KEY, 'true');
    setIsVisible(false);
  };

  if (!isVisible || dismissed) {
    return null;
  }

  const isAndroid = storeToOffer() === 'android';

  return (
    <div className="xl:hidden fixed left-0 right-0 z-30 p-4 bottom-[calc(56px+env(safe-area-inset-bottom,0px))]">
      <div className="max-w-lg mx-auto bg-surface-elevated/95 backdrop-blur-xl ring-1 ring-line-subtle rounded-2xl shadow-floating">
        <div className="flex flex-col gap-3 p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-on-soft"><Smartphone className="h-5 w-5" aria-hidden="true" /></span>
            <div className="flex-1 min-w-0">
              <h3 className="text-[15px] font-semibold text-content mb-0.5">
                {isAndroid ? t.mobileBannerAndroidTitle : t.mobileBannerTitle}
              </h3>
              <p className="text-sm text-content-secondary leading-relaxed">
                {isAndroid ? t.mobileBannerAndroidMessage : t.mobileBannerMessage}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={isAndroid ? GOOGLE_PLAY_URL : APP_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleDismiss}
              className="flex-1 inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-ink text-white text-sm font-semibold hover:opacity-90 transition-opacity dark:bg-white dark:text-ink"
            >
              {isAndroid ? (
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                  <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
                </svg>
              ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
              </svg>
              )}
              {isAndroid ? t.mobileBannerPlayCta : t.mobileBannerCta}
            </a>
            <button
              onClick={handleDismiss}
              className="h-10 px-4 text-sm font-semibold text-content-secondary bg-surface-sunken hover:text-content rounded-lg transition-colors"
            >
              {t.later}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileBanner;

