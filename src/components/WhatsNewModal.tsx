import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, CheckCircle2, Palette, MousePointerClick, Smartphone } from 'lucide-react';
import { APP_STORE_URL, GOOGLE_PLAY_URL } from '../constants/links';
import { useI18n } from '../context/I18nContext';
import { analyticsHelpers } from '../utils/analytics';

interface WhatsNewModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Versioned dismissal key: bump the suffix whenever the modal content changes
// so the modal reappears once per user for the new release.
export const WHATS_NEW_DISMISSED_KEY = 'whatsNewModalDismissed_v0.6.0';

/** Apple logo (for the Apple sign-in and App Store items). */
const AppleGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`fill-current ${className ?? ''}`} aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
  </svg>
);

/** Google Play logo (for the Android item). */
const PlayGlyph = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={`fill-current ${className ?? ''}`} aria-hidden="true">
    <path d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594zM1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924zm12.207 10.065l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973zm0 2.067l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
  </svg>
);

export const WhatsNewModal = ({ isOpen, onClose }: WhatsNewModalProps) => {
  const { t } = useI18n();
  const [isUnderstood, setIsUnderstood] = useState(false);
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // Prevenir scroll do body quando modal estiver aberto
  useEffect(() => {
    if (!isOpen) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    analyticsHelpers.logWhatsNewModalOpened();
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isOpen]);

  // Detectar quando o usuário rola até o final do conteúdo
  useEffect(() => {
    if (!isOpen || !contentRef.current) return;

    const handleScroll = () => {
      const element = contentRef.current;
      if (!element) return;

      // Verificar se chegou ao final (com uma pequena margem de tolerância)
      const isAtBottom = 
        element.scrollHeight - element.scrollTop <= element.clientHeight + 10;
      
      setHasScrolledToEnd(isAtBottom);
    };

    const element = contentRef.current;
    element.addEventListener('scroll', handleScroll);
    
    // Verificar estado inicial
    handleScroll();

    return () => {
      element.removeEventListener('scroll', handleScroll);
    };
  }, [isOpen]);

  // Prevenir fechamento com ESC
  useEffect(() => {
    if (!isOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (!isUnderstood || !hasScrolledToEnd)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isUnderstood, hasScrolledToEnd]);

  const handleClose = () => {
    if (!isUnderstood || !hasScrolledToEnd) {
      return; // Não permite fechar sem marcar o checkbox e rolar até o final
    }
    analyticsHelpers.logWhatsNewModalClosed(hasScrolledToEnd, isUnderstood);
    localStorage.setItem(WHATS_NEW_DISMISSED_KEY, 'true');
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && (!isUnderstood || !hasScrolledToEnd)) {
      return; // Não permite fechar clicando no backdrop sem marcar o checkbox e rolar até o final
    }
    if (isUnderstood && hasScrolledToEnd) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-end sm:items-center justify-center sm:p-4 animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whats-new-title"
      onClick={handleBackdropClick}
    >
      <div className="relative w-full max-w-2xl max-h-[90dvh] bg-surface-elevated flex flex-col rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
        {/* Header - Sem botão de fechar se não estiver marcado */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-line-subtle flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-brand-soft rounded-lg">
              <Sparkles className="h-6 w-6 text-brand-on-soft" aria-hidden="true" />
            </div>
            <h2
              id="whats-new-title"
              className="font-rounded text-xl font-bold text-content"
            >
              {t.whatsNewTitle || 'Novidades do Recta'}
            </h2>
          </div>
          {isUnderstood && hasScrolledToEnd && (
            <button
              onClick={handleClose}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-content-secondary hover:text-content transition-colors"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div 
          ref={contentRef}
          className="overflow-y-auto flex-1 p-6 space-y-6"
        >
          <div className="space-y-4">
            <p className="text-[15px] leading-relaxed text-content-secondary">{t.whatsNewV06Intro}</p>

            {[
              { icon: Palette, tint: 'bg-brand-soft text-brand-on-soft', title: t.whatsNewV06LookTitle, items: [t.whatsNewV06Look1, t.whatsNewV06Look2, t.whatsNewV06Look3] },
              { icon: MousePointerClick, tint: 'bg-info/10 text-info', title: t.whatsNewV06EasierTitle, items: [t.whatsNewV06Easier1, t.whatsNewV06Easier2, t.whatsNewV06Easier3, t.whatsNewV06Easier4] },
            ].map(({ icon: Icon, tint, title, items }) => (
              <section key={title} className="rounded-xl bg-surface-sunken/70 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tint}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="font-rounded text-base font-semibold text-content">{title}</h3>
                </div>
                <ul className="space-y-2 text-sm text-content-secondary">
                  {items.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-positive" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            {/* Login com Apple */}
            <section className="flex items-start gap-3 rounded-xl bg-surface-sunken/70 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-black text-white dark:bg-white dark:text-black">
                <AppleGlyph className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-rounded text-base font-semibold text-content mb-1">{t.whatsNewV06AppleTitle}</h3>
                <p className="text-sm text-content-secondary leading-relaxed">{t.whatsNewV06AppleText}</p>
              </div>
            </section>

            {/* Recta no iPhone */}
            <section className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#6D4CFF] to-[#4A2EE0] p-5 text-white">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Smartphone className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <h3 className="font-rounded text-base font-semibold mb-1">{t.whatsNewV06IphoneTitle}</h3>
                  <p className="text-sm text-white/85 leading-relaxed">{t.whatsNewV06IphoneText}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <a
                      href={APP_STORE_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white text-ink text-sm font-semibold hover:bg-white/90 transition-colors"
                    >
                      <AppleGlyph className="h-4 w-4" />
                      {t.mobileBannerCta}
                    </a>
                    <a
                      href={GOOGLE_PLAY_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 h-10 px-4 rounded-lg bg-white text-ink text-sm font-semibold hover:bg-white/90 transition-colors"
                    >
                      <PlayGlyph className="h-4 w-4" />
                      {t.mobileBannerPlayCta}
                    </a>
                  </div>
                </div>
              </div>
            </section>

            {/* Footer com Checkbox - Dentro do conteúdo scrollável */}
            <div className="mt-2 pt-5 border-t border-line-subtle">
              {!hasScrolledToEnd && (
                <div className="text-center py-4">
                  <p className="text-sm text-content-tertiary italic">
                    {t.pleaseScrollToEndToContinue}
                  </p>
                </div>
              )}
              {hasScrolledToEnd && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={isUnderstood}
                      onChange={(e) => setIsUnderstood(e.target.checked)}
                      className="h-5 w-5 rounded accent-[rgb(var(--brand-fill))]"
                    />
                    <span className="text-sm text-content-secondary group-hover:text-content transition-colors">
                      {t.whatsNewUnderstand || 'Eu compreendo e li todas as informações acima'}
                    </span>
                  </label>
                  <button
                    onClick={handleClose}
                    disabled={!isUnderstood}
                    className={`h-11 px-6 rounded-lg text-[15px] font-semibold transition-colors ${
                      isUnderstood
                        ? 'bg-brand-fill hover:bg-brand-fill-hover text-white cursor-pointer'
                        : 'bg-surface-sunken text-content-tertiary cursor-not-allowed'
                    }`}
                  >
                    {t.whatsNewContinue || 'Continuar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
