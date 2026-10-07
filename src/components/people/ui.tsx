import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

// Shared styles and the dialog shell of the people screens.

export const FIELD_CLS =
  'border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50';
export const INPUT_CLS = `w-full px-3 py-2.5 text-sm ${FIELD_CLS}`;
export const INPUT_SM_CLS = `w-full px-2 py-1.5 text-sm ${FIELD_CLS}`;
export const BTN_BASE = 'inline-flex items-center justify-center font-light tracking-tight rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_SECONDARY = `${BTN_BASE} px-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`;
export const BTN_SECONDARY_SM = `${BTN_BASE} px-3 py-1.5 text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`;
export const BTN_PRIMARY = `${BTN_BASE} px-4 py-2.5 text-sm text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 hover:opacity-80`;
export const BTN_DANGER = `${BTN_BASE} px-4 py-2.5 text-sm text-white bg-red-500 border border-red-500 hover:opacity-80`;
export const LINK_CLS = 'text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50';
export const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';
export const CHECKBOX_CLS = 'h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60';
export const TABLE_WRAP_CLS = 'overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md';
export const THEAD_ROW_CLS = 'bg-gray-50 dark:bg-gray-800/50';
export const TBODY_CLS = 'divide-y divide-gray-200 dark:divide-gray-800';
export const TH_CLS = 'px-3 py-2 font-medium text-gray-700 dark:text-gray-200 text-left whitespace-nowrap';
export const TD_CLS = 'px-3 py-2 text-gray-900 dark:text-white align-top';
export const MUTED_CLS = 'text-gray-600 dark:text-gray-400';
export const H4_CLS = 'text-sm font-medium text-gray-900 dark:text-white';
export const BOX_CLS = 'rounded-md border border-gray-200 dark:border-gray-800 p-4 space-y-2';
export const ERROR_CLS = 'text-xs text-red-600 dark:text-red-400';
export const NOTICE_BOX_CLS =
  'rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-900 dark:text-orange-200 space-y-1';

export const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  /** False while a request that must not be abandoned is in flight: ESC, the backdrop and the X do nothing. */
  canClose: boolean;
  titleId: string;
  title: string;
  icon?: ReactNode;
  /** Tailwind max-width class of the panel. */
  widthClass?: string;
  /** Stacking level: a dialog opened from another one needs the higher one. */
  zClass?: string;
  children: ReactNode;
}

// Open shells, oldest first. Only the topmost one answers ESC (the nested person form must not take the dialog under
// it along), and the page scroll stays locked until the last one is gone, whatever order they unmount in.
const openShells: symbol[] = [];
let savedOverflow = '';

function lockScroll(): void {
  if (openShells.length === 1) {
    savedOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll(): void {
  if (openShells.length === 0) document.body.style.overflow = savedOverflow;
}

// The first thing worth typing in: an enabled field. Buttons are not "relevant" first targets (Cancelar is enabled while a
// dialog is still loading).
const FIELDS = 'input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled])';

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Keeps Tab and Shift+Tab inside the panel: the page behind a modal dialog must not be reachable by keyboard. */
function trapTab(e: KeyboardEvent, panel: HTMLElement | null): void {
  if (!panel) return;
  const items = Array.from(panel.querySelectorAll<HTMLElement>(TABBABLE));
  const active = document.activeElement;
  if (items.length === 0) {
    e.preventDefault();
    panel.focus();
    return;
  }
  const first = items[0]!;
  const last = items[items.length - 1]!;
  if (!panel.contains(active) || active === panel) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Portal, backdrop, scroll lock, ESC and Tab for the topmost shell only, focus in and back, and the close guard. */
export const DialogShell = ({ open, onClose, canClose, titleId, title, icon, widthClass = 'max-w-2xl', zClass = 'z-[60]', children }: DialogShellProps) => {
  const { t } = useI18n();
  const canCloseRef = useRef(canClose);
  canCloseRef.current = canClose;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);
  // The control that had focus when this opening began (undefined: not captured). It is read during the render that
  // opens the dialog, BEFORE the children mount: a child with autoFocus would already hold the focus by any effect.
  const returnFocusRef = useRef<HTMLElement | null | undefined>(undefined);
  const focusedFieldRef = useRef(false);
  if (!open) {
    returnFocusRef.current = undefined;
  } else if (returnFocusRef.current === undefined) {
    const active = typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    returnFocusRef.current = active && active !== document.body ? active : null;
  }

  useEffect(() => {
    if (!open) return;
    const id = Symbol('shell');
    // Read now: by the cleanup the closing render has already reset the ref.
    const returnTo = returnFocusRef.current;
    openShells.push(id);
    lockScroll();
    focusedFieldRef.current = false;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (openShells[openShells.length - 1] !== id) return;
      if (e.key === 'Escape') {
        if (canCloseRef.current) onCloseRef.current();
      } else if (e.key === 'Tab') {
        trapTab(e, panelRef.current);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      openShells.splice(openShells.indexOf(id), 1);
      unlockScroll();
      if (returnTo && returnTo.isConnected) returnTo.focus();
    };
  }, [open]);

  // Focus: the panel itself while there is nothing to type in (loading), then the first field as soon as one exists --
  // once, and only if the user has not already moved focus somewhere inside.
  useEffect(() => {
    if (!open || focusedFieldRef.current) return;
    const panel = panelRef.current;
    if (!panel) return;
    const inside = panel.contains(document.activeElement) && document.activeElement !== panel;
    const field = panel.querySelector<HTMLElement>(FIELDS);
    if (inside) focusedFieldRef.current = true;
    else if (field) {
      field.focus();
      focusedFieldRef.current = true;
    } else if (document.activeElement !== panel) panel.focus();
  });

  if (!open) return null;
  const requestClose = () => {
    if (canCloseRef.current) onClose();
  };
  return createPortal(
    <div className={`fixed inset-0 ${zClass} overflow-y-auto`}>
      <div className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out" onClick={requestClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
          className={`relative w-full ${widthClass} p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom focus:outline-none`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              {icon}
              <h3 id={titleId} className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">{title}</h3>
            </div>
            <button type="button" data-shell-close onClick={requestClose} disabled={!canClose} aria-label={t.close}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

const CHIP_TONES = {
  blue: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
} as const;
export type ChipTone = keyof typeof CHIP_TONES;

export const Chip = ({ tone, title, children }: { tone: ChipTone; title?: string; children: ReactNode }) => (
  <span title={title} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${CHIP_TONES[tone]}`}>
    {children}
  </span>
);
