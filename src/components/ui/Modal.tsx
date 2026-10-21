import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon, X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { cn } from './cn';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const widths: Record<Size, string> = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg', xl: 'sm:max-w-2xl' };

type Tone = 'brand' | 'negative' | 'warning' | 'positive' | 'info';
const tones: Record<Tone, string> = {
  brand: 'bg-brand-soft text-brand-on-soft',
  negative: 'bg-negative-soft text-negative-on-soft',
  warning: 'bg-warning/10 text-warning',
  positive: 'bg-positive-soft text-positive',
  info: 'bg-info/10 text-info',
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  iconTone?: Tone;
  /** Sticky footer, usually the action buttons. */
  footer?: ReactNode;
  size?: Size;
  children?: ReactNode;
  /** Blocks closing by backdrop/Esc (e.g. while saving). */
  dismissible?: boolean;
  className?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * The one modal shell of the app. Centered card on desktop, bottom sheet on phones (like the
 * iOS sheets), with focus trap, Esc to close, body scroll lock and focus restore.
 */
export const Modal = ({
  isOpen, onClose, title, description, icon: Icon, iconTone = 'brand', footer, size = 'md', children, dismissible = true, className,
}: ModalProps) => {
  const { t } = useI18n();
  const titleId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    // Focus the first field if there is one, otherwise the panel itself.
    const first = panel?.querySelector<HTMLElement>('input,select,textarea') ?? panel;
    first?.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, dismissible]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex w-full max-h-[92dvh] flex-col bg-surface-elevated shadow-floating outline-none',
          'rounded-t-[28px] sm:rounded-2xl animate-modal-panel',
          'pb-[env(safe-area-inset-bottom)] sm:pb-0',
          widths[size],
          className,
        )}
      >
        {/* Grabber, phones only: signals the sheet */}
        <div className="sm:hidden mx-auto mt-2 h-1 w-9 rounded-full bg-line" aria-hidden="true" />
        <div className="flex items-start gap-3 px-5 pt-4 sm:pt-5 pb-3">
          {Icon && (
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[iconTone])}>
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-1">
            <h2 id={titleId} className="font-rounded text-lg font-semibold leading-tight text-content">{title}</h2>
            {description && <p id={descId} className="mt-1 text-sm text-content-secondary">{description}</p>}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.close}
              className="-me-1.5 -mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-content-secondary hover:text-content transition-colors"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end border-t border-line-subtle px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
