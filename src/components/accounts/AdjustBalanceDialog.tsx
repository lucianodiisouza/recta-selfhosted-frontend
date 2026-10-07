import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Scale, X } from 'lucide-react';
import { useAdjustAccountBalance } from '../../hooks/api/useAccounts';
import { useToastContext } from '../../context/ToastContext';
import { CURRENCIES, useCurrency } from '../../context/CurrencyContext';
import { useI18n } from '../../context/I18nContext';
import { formatCurrency } from '../../utils/format';
import {
  MAX_REASON_LENGTH, adjustReasonKind, adjustmentDateHonored, buildAdjustBody, formatIsoDate, lastDayOfPreviousYear, maskMoneyInput, reaisToCents,
  todayIsoDate, validateAdjust,
} from '../../utils/adjustBalance';
import type { AdjustErrorCode } from '../../utils/adjustBalance';

interface AdjustBalanceDialogProps {
  open: boolean;
  onClose: () => void;
  accountId: string | null;
  accountName: string;
  /** Current total balance, as the account page shows it. */
  currentBalance: number;
}

const INPUT_CLS =
  'w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50';
const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';
const MUTED_CLS = 'text-gray-600 dark:text-gray-400';
const ERROR_CLS = 'text-xs text-red-600 dark:text-red-400';
const BTN_CLS = 'inline-flex items-center justify-center font-light tracking-tight rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2.5 text-sm';

/** What Tab can reach: enabled fields and buttons. */
const FOCUSABLE = 'input:not([disabled]), button:not([disabled])';

const fill = (text: string, values: Record<string, string>): string =>
  text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => values[key] ?? match);

/**
 * "Adjust balance": makes the account balance match the bank with ONE adjustment entry (an income when the account is
 * short, an expense when it is over). No payment or transaction that exists is touched. The entry is dated by the user:
 * an opening balance goes at the end of the previous year so it stays out of this year's reports.
 */
const AdjustBalanceDialog = ({ open, onClose, accountId, accountName, currentBalance }: AdjustBalanceDialogProps) => {
  const { t, locale } = useI18n();
  const { success, warning, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);
  const mutation = useAdjustAccountBalance();

  const [targetText, setTargetText] = useState('');
  const [date, setDate] = useState(todayIsoDate());
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mountedRef = useRef(true);
  const canCloseRef = useRef(true);
  canCloseRef.current = !saving;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Latest wins: an answer that arrives after the dialog was reopened (another account, a fresh form) changes nothing.
  const openingRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  const defaultReasons = { opening: t.adjustBalanceReasonOpening, adjust: t.adjustBalanceReasonDefault };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Every opening starts from a blank form: the balance is typed on purpose, never preset. The reason starts empty and
  // is shown as a placeholder: a blank reason is replaced by the default for the date when it is sent.
  useEffect(() => {
    if (!open) return;
    openingRef.current += 1;
    setTargetText('');
    setDate(todayIsoDate());
    setReason('');
    setConfirmed(false);
    setFormError(null);
  }, [open, accountId]);

  // Scroll lock, ESC and keyboard focus while open. ESC does nothing while a request is in flight. Focus moves into the
  // dialog, Tab and Shift+Tab wrap inside it, and focus goes back to the control that opened it when it closes.
  useEffect(() => {
    if (!open || !accountId) return;
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    (panel?.querySelector<HTMLElement>('#adjust-target') ?? panel?.querySelector<HTMLElement>(FOCUSABLE))?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canCloseRef.current) {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!panel.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', handleKey);
      if (returnTo?.isConnected) returnTo.focus();
    };
  }, [open, accountId]);

  const currentCents = reaisToCents(currentBalance);
  // The field fills from the right in cents, so it always shows two decimals, even for a currency that has none.
  const fieldFormat = useMemo(() => {
    const info = CURRENCIES[baseCurrency];
    return new Intl.NumberFormat(info.locale, { style: 'currency', currency: info.code, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, [baseCurrency]);
  const target = useMemo(() => maskMoneyInput(targetText, (cents) => fieldFormat.format(cents / 100)), [targetText, fieldFormat]);
  const input = { currentCents, targetCents: target.cents, date, reason };
  const check = validateAdjust(input);
  const diff = check.differenceCents;

  const errorText = (code: AdjustErrorCode | undefined): string | null => {
    switch (code) {
      case 'targetRequired': return t.adjustBalanceErrTargetRequired;
      case 'sameBalance': return t.adjustBalanceErrSameBalance;
      case 'dateRequired': return t.adjustBalanceErrDateRequired;
      case 'dateInvalid': return t.adjustBalanceErrDateInvalid;
      case 'dateFuture': return t.adjustBalanceErrDateFuture;
      case 'reasonTooLong': return fill(t.adjustBalanceErrReasonTooLong, { max: String(MAX_REASON_LENGTH) });
      default: return null;
    }
  };
  const entryText = (difference: number): string =>
    fill(difference > 0 ? t.adjustBalanceEntryIncome : t.adjustBalanceEntryExpense, { amount: money(Math.abs(difference)) });

  // Anything the user is shown the confirmation for must be what is sent: editing a field takes the confirmation back.
  const edit = (apply: () => void) => {
    apply();
    setConfirmed(false);
    setFormError(null);
  };

  const handleSave = async () => {
    if (!accountId || savingRef.current || !confirmed) return;
    const body = buildAdjustBody(input, defaultReasons);
    if (!body) {
      setFormError(t.adjustBalanceReview);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    const opening = openingRef.current;
    const sentDiff = diff;
    try {
      const result = await mutation.mutateAsync({ accountId, ...body });
      if (!result.adjustment || sentDiff === null) {
        success(t.adjustBalanceAlreadyThere);
      } else if (adjustmentDateHonored(body.date, result.adjustment.date)) {
        success(fill(t.adjustBalanceDone, { entry: entryText(sentDiff), date: formatIsoDate(body.date, locale) }));
      } else {
        // An older backend ignores `date`: say so instead of reporting a date that was not applied.
        warning(fill(t.adjustBalanceDateIgnored, {
          requested: formatIsoDate(body.date, locale),
          date: new Date(result.adjustment.date!).toLocaleDateString(locale),
        }));
      }
      if (opening === openingRef.current && mountedRef.current) {
        // Applied: another submit needs a new confirmation, even if the parent keeps the dialog open.
        setConfirmed(false);
        onClose();
      }
    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : t.adjustBalanceFailed;
      if (opening === openingRef.current && mountedRef.current) setFormError(message);
      showError(message);
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  if (!open || !accountId) return null;

  const ready = check.ok && confirmed && diff !== null;
  const openingDate = formatIsoDate(lastDayOfPreviousYear(), locale);
  // A missing target is not an error before the user typed anything.
  const targetError = targetText ? errorText(check.errors.target) : null;
  const dateError = errorText(check.errors.date);
  const reasonError = errorText(check.errors.reason);
  const requestClose = () => {
    if (!saving) onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/40" onClick={requestClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="adjust-balance-title"
          className="relative w-full max-w-lg p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              <Scale className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />
              <h3 id="adjust-balance-title" className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">
                {fill(t.adjustBalanceTitle, { name: accountName })}
              </h3>
            </div>
            <button type="button" onClick={requestClose} disabled={saving} aria-label={t.close}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1 disabled:opacity-50">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 min-w-0">
            <p className={`text-sm ${MUTED_CLS}`}>{fill(t.adjustBalanceCurrent, { amount: money(currentCents) })}</p>

            <div>
              <label htmlFor="adjust-target" className={LABEL_CLS}>{t.adjustBalanceTargetLabel}</label>
              <input id="adjust-target" type="text" inputMode="numeric" autoComplete="off" value={target.display} disabled={saving}
                className={INPUT_CLS} placeholder={fieldFormat.format(0)} aria-invalid={targetError ? true : undefined}
                onChange={(e) => edit(() => setTargetText(e.target.value))} />
              {targetError && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{targetError}</p>}
            </div>

            <div>
              <label htmlFor="adjust-date" className={LABEL_CLS}>{t.adjustBalanceDateLabel}</label>
              <input id="adjust-date" type="date" value={date} max={todayIsoDate()} disabled={saving} className={INPUT_CLS}
                aria-invalid={dateError ? true : undefined} onChange={(e) => edit(() => setDate(e.target.value))} />
              {dateError && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{dateError}</p>}
              <p className={`mt-1 text-xs ${MUTED_CLS}`}>
                {fill(t.adjustBalanceOpeningHint, { date: openingDate })}{' '}
                <button type="button" disabled={saving} onClick={() => edit(() => setDate(lastDayOfPreviousYear()))}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50">
                  {fill(t.adjustBalanceUseDate, { date: openingDate })}
                </button>
              </p>
            </div>

            <div>
              <label htmlFor="adjust-reason" className={LABEL_CLS}>{t.adjustBalanceReasonLabel}</label>
              <input id="adjust-reason" type="text" value={reason} disabled={saving} className={INPUT_CLS}
                placeholder={defaultReasons[adjustReasonKind(date)]}
                onChange={(e) => edit(() => setReason(e.target.value))} />
              {reasonError && <p role="alert" className={`mt-1 ${ERROR_CLS}`}>{reasonError}</p>}
            </div>

            {diff !== null && diff !== 0 && (
              <div className="rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-900 dark:text-orange-200 space-y-1" aria-live="polite">
                <p>
                  {fill(t.adjustBalanceDifference, {
                    difference: `${diff > 0 ? '+' : '-'}${money(Math.abs(diff))}`,
                    entry: entryText(diff),
                    date: formatIsoDate(date, locale),
                    balance: money(target.cents ?? 0),
                  })}
                </p>
                <p className="text-xs">{t.adjustBalanceNoChange}</p>
                <p className="text-xs">{t.adjustBalanceStaleHint}</p>
              </div>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
                checked={confirmed} disabled={saving || !check.ok} onChange={(e) => setConfirmed(e.target.checked)} />
              <span>{t.adjustBalanceConfirm}</span>
            </label>

            {formError && <p role="alert" className={ERROR_CLS}>{formError}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={requestClose} disabled={saving}
                className={`${BTN_CLS} text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`}>
                {t.cancel}
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving || !ready}
                className={`${BTN_CLS} text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 hover:opacity-80`}>
                {saving ? t.adjustBalanceSaving : t.adjustBalanceAction}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default AdjustBalanceDialog;
