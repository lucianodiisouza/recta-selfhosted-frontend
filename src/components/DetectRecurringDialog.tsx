import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, RefreshCw, Repeat, X } from 'lucide-react';
import { useApplyDetectedRecurring, useDetectRecurring } from '../hooks/api/useDetectRecurring';
import type { RecurringApplyResult, RecurringApplyWarning, RecurringCandidate, RecurringDetectSkipped } from '../hooks/api/useDetectRecurring';
import { useToastContext } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { formatCurrency, formatDate, parseDateFromAPI } from '../utils/format';
import { fillTemplate } from '../utils/fillTemplate';
import {
  MAX_DESCRIPTION, allFollowLast, amountVaried, applyRefusedBeforeWriting, buildDetectApply, confidenceText, defaultDraft, detectBlocker,
  groupCandidates, kindFullySelected, reconcileDraft, resolveCandidate, setAllFollowLast, setAmountText, setDayText, setDescriptionText,
  setFollowLast, setKindSelected, setSelected,
} from '../utils/recurringDetect';
import type { AmountError, DescriptionError, DetectBlockerCode, DetectDraft } from '../utils/recurringDetect';

const BLOCKER_ID = 'detect-recurring-blocker';
const EMPTY_DRAFT: DetectDraft = { selected: {}, edits: {} };
/** The server defaults (3 months in a 12 month window): nothing is asked of the user before detecting. */
const DETECT_PARAMS: { minMonths?: number; months?: number } = {};
const ERROR_TOAST_MS = 10000;

const FIELD_CLS = 'border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50';
const INPUT_CLS = `w-full px-2 py-1.5 text-sm ${FIELD_CLS}`;
const BTN_BASE = 'inline-flex items-center justify-center font-light tracking-tight rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
const BTN_SECONDARY = `${BTN_BASE} px-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`;
const BTN_PRIMARY = `${BTN_BASE} px-4 py-2.5 text-sm text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 hover:opacity-80`;
const LINK_CLS = 'text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50';
const CHECKBOX_CLS = 'h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 focus:ring-primary-500 disabled:cursor-not-allowed disabled:opacity-60';
const MUTED_CLS = 'text-gray-600 dark:text-gray-400';
const ERROR_CLS = 'text-xs text-red-600 dark:text-red-400';
const TH_CLS = 'px-3 py-2 font-medium text-gray-700 dark:text-gray-200 text-left whitespace-nowrap';
const TD_CLS = 'px-3 py-2 text-gray-900 dark:text-white align-top';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const getErrorMessage = (err: unknown, fallback: string): string => (err instanceof Error && err.message ? err.message : fallback);

/** The server has no detection route at all (a 404/405 from the framework's router carries no app error code). */
const isDetectUnavailable = (err: unknown): boolean => {
  const { status, code } = (err as { status?: unknown; code?: unknown } | null) ?? {};
  return (status === 404 || status === 405) && code === undefined;
};

interface DetectRecurringDialogProps {
  open: boolean;
  onClose: () => void;
  householdId: string | undefined;
  /** EDITOR or more. A viewer can read the candidates, but sees no way to choose, adjust or create. */
  canWrite: boolean;
  /** Called when the server turns out not to have the detection routes, so the caller can drop its entry point. */
  onUnavailable?: () => void;
}

/** "Detect recurring": proposes the recurring expenses found in the history; one apply creates the ones chosen. */
const DetectRecurringDialog = ({ open, onClose, householdId, canWrite, onUnavailable }: DetectRecurringDialogProps) => {
  const { success, showToast } = useToastContext();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const money = (cents: number): string => formatCurrency(cents / 100, baseCurrency);
  const reais = (value: number): string => formatCurrency(value, baseCurrency);

  const detectMutation = useDetectRecurring();
  const applyMutation = useApplyDetectedRecurring();
  const applying = applyMutation.isPending;

  const [candidates, setCandidates] = useState<RecurringCandidate[] | null>(null);
  const [skipped, setSkipped] = useState<RecurringDetectSkipped | null>(null);
  const [draft, setDraft] = useState<DetectDraft>(EMPTY_DRAFT);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [result, setResult] = useState<RecurringApplyResult | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const candidatesRef = useRef<RecurringCandidate[] | null>(null);
  // Latest-wins: a detection only touches state while it is the newest run of a mounted, open dialog.
  const seqRef = useRef(0);
  const mountedRef = useRef(true);
  // Synchronous twin of `applying`: a second click before React re-renders must not send a second request.
  const applyingRef = useRef(false);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef<HTMLDivElement>(null);
  const applyingForEscape = useRef(false);
  applyingForEscape.current = applying;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const runDetect = async () => {
    if (!householdId) return;
    seqRef.current += 1;
    const run = seqRef.current;
    const isCurrent = () => mountedRef.current && run === seqRef.current;
    setDetecting(true);
    try {
      const data = await detectMutation.mutateAsync({ householdId, ...DETECT_PARAMS });
      if (!isCurrent()) return;
      const next = data.candidates ?? [];
      const prev = candidatesRef.current;
      candidatesRef.current = next;
      setCandidates(next);
      setSkipped(data.skipped ?? null);
      setDraft((current) => (prev ? reconcileDraft(current, prev, next) : defaultDraft(next)));
      setDetectError(null);
      // A new list is a fresh start for the failed apply: the stale list is gone.
      setApplyError(null);
    } catch (err: unknown) {
      if (!isCurrent()) return;
      if (isDetectUnavailable(err)) {
        onUnavailableRef.current?.();
        return;
      }
      const message = getErrorMessage(err, t.detectRecFailed);
      setDetectError(message);
      showToast(message, 'error', ERROR_TOAST_MS);
    } finally {
      if (isCurrent()) setDetecting(false);
    }
  };

  // Every opening starts over and detects at once.
  useEffect(() => {
    if (!open) return;
    candidatesRef.current = null;
    setCandidates(null);
    setSkipped(null);
    setDraft(EMPTY_DRAFT);
    setDetectError(null);
    setApplyError(null);
    setResult(null);
    setExpanded({});
    void runDetect();
    return () => {
      seqRef.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, householdId]);

  // ESC closes, except while the recurrences are being created (the result must not be abandoned); the page does not
  // scroll behind the dialog; the focus moves into the dialog, Tab stays inside it and the focus goes back to the control
  // that opened it.
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applyingForEscape.current) {
        closeRef.current();
        return;
      }
      if (e.key !== 'Tab' || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  const list = useMemo(() => candidates ?? [], [candidates]);
  const groups = useMemo(() => groupCandidates(list), [list]);
  const built = useMemo(
    () => (candidates && householdId ? buildDetectApply(householdId, candidates, draft, DETECT_PARAMS) : null),
    [candidates, householdId, draft],
  );
  const blocker: DetectBlockerCode | null = canWrite ? detectBlocker(built, { needsRefresh: applyError !== null, applying }) : null;

  const blockerText = (code: DetectBlockerCode): string => {
    switch (code) {
      case 'applying': return t.detectRecCreating;
      case 'needs-refresh': return t.detectRecBlockRefresh;
      case 'none-selected': return t.detectRecBlockNone;
      case 'invalid': return t.detectRecBlockInvalid;
    }
  };
  const amountErrorText = (code: AmountError): string =>
    code === 'empty' ? t.detectRecErrAmountEmpty : code === 'invalid' ? t.detectRecErrAmountInvalid : t.detectRecErrAmountZero;
  const descriptionErrorText = (code: DescriptionError): string =>
    code === 'empty' ? t.detectRecErrDescEmpty : fillTemplate(t.detectRecErrDescLong, { max: MAX_DESCRIPTION });
  const resultLines = (data: RecurringApplyResult): string[] => {
    const lines: string[] = [];
    if (data.created > 0) lines.push(fillTemplate(t.detectRecResultCreated, { count: data.created }));
    if (data.linkedTransactions > 0) lines.push(fillTemplate(t.detectRecResultLinked, { count: data.linkedTransactions }));
    if (data.skipped > 0) lines.push(fillTemplate(t.detectRecResultSkipped, { count: data.skipped }));
    return lines;
  };
  const warningText = (w: RecurringApplyWarning): string => {
    if (w.code === 'duplicate-in-call') return fillTemplate(t.detectRecWarnDuplicate, { name: w.description });
    if (w.code === 'already-active') return fillTemplate(t.detectRecWarnActive, { name: w.description });
    return fillTemplate(t.detectRecWarnShortMonth, { name: w.description, day: w.dayOfMonth ?? '' });
  };
  const skippedReasons = (s: RecurringDetectSkipped | null): string[] => {
    if (!s) return [];
    const reasons: string[] = [];
    if (s.alreadyRecurring > 0) reasons.push(fillTemplate(t.detectRecSkipRecurring, { count: s.alreadyRecurring }));
    if (s.installments > 0) reasons.push(fillTemplate(t.detectRecSkipInstallments, { count: s.installments }));
    if (s.sparse > 0) reasons.push(fillTemplate(t.detectRecSkipSparse, { count: s.sparse }));
    if (s.consumption > 0) reasons.push(fillTemplate(t.detectRecSkipConsumption, { count: s.consumption }));
    return reasons;
  };

  const handleApply = async () => {
    if (!canWrite || !built || blocker || applying || detecting || applyingRef.current) return;
    applyingRef.current = true;
    try {
      const data = await applyMutation.mutateAsync(built.payload);
      success(resultLines(data).join(' ') || t.detectRecResultNothing);
      if (mountedRef.current) setResult(data);
    } catch (err: unknown) {
      const reason = getErrorMessage(err, t.detectRecApplyFailed).trim() || t.detectRecApplyFailed;
      const ended = /[.!?]$/.test(reason) ? reason : `${reason}.`;
      const status = (err as { status?: number } | null)?.status;
      const message = `${ended} ${applyRefusedBeforeWriting(status) ? t.detectRecApplyRefused : t.detectRecApplyPartial}`;
      showToast(message, 'error', ERROR_TOAST_MS);
      if (mountedRef.current) setApplyError(message);
    } finally {
      applyingRef.current = false;
    }
  };

  const update = (fn: (d: DetectDraft) => DetectDraft) => setDraft(fn);
  const loading = candidates === null && detecting;
  const reasons = skippedReasons(skipped);
  const busy = applying;
  const totals = built?.totals;

  const renderRow = (c: RecurringCandidate) => {
    const r = resolveCandidate(c, draft);
    const varied = amountVaried(c);
    const isOpen = expanded[c.id] === true;
    const rowId = `detect-${c.id}`;
    return (
      <Fragment key={c.id}>
        <tr className={r.selected ? '' : 'bg-gray-50/60 dark:bg-gray-800/20'} data-candidate={c.id}>
          {canWrite && (
            <td className="px-3 py-2 align-top">
              <input type="checkbox" checked={r.selected} disabled={busy} className={CHECKBOX_CLS} aria-label={fillTemplate(t.detectRecAriaCreate, { name: c.description })}
                onChange={(e) => update((d) => setSelected(d, c.id, e.target.checked))} />
            </td>
          )}
          <td className={`${TD_CLS} min-w-[200px]`}>
            {canWrite ? (
              <>
                <input type="text" value={r.description} disabled={busy} maxLength={MAX_DESCRIPTION + 100} aria-label={fillTemplate(t.detectRecAriaDescription, { name: c.description })}
                  aria-invalid={r.errors.description ? true : undefined} className={INPUT_CLS} onChange={(e) => update((d) => setDescriptionText(d, c.id, e.target.value))} />
                {r.errors.description && <p role="alert" className={ERROR_CLS}>{descriptionErrorText(r.errors.description)}</p>}
              </>
            ) : (
              <p>{c.description}</p>
            )}
            <button type="button" className={`${LINK_CLS} mt-1 inline-flex items-center gap-1`} aria-expanded={isOpen} aria-controls={`${rowId}-examples`}
              aria-label={fillTemplate(t.detectRecAriaExamples, { name: c.description })} onClick={() => setExpanded((e) => ({ ...e, [c.id]: !isOpen }))}>
              {isOpen ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
              {c.examples.length === 1 ? t.detectRecExamplesOne : fillTemplate(t.detectRecExamplesMany, { count: c.examples.length })}
            </button>
          </td>
          <td className={`${TD_CLS} whitespace-nowrap`}>{c.accountName}</td>
          <td className={`${TD_CLS} w-36`}>
            {canWrite ? (
              <>
                <input type="text" inputMode="decimal" value={r.amountText} disabled={busy} aria-label={fillTemplate(t.detectRecAriaAmount, { name: c.description })}
                  aria-invalid={r.errors.amount ? true : undefined} className={INPUT_CLS} onChange={(e) => update((d) => setAmountText(d, c.id, e.target.value))} />
                {r.errors.amount && <p role="alert" className={ERROR_CLS}>{amountErrorText(r.errors.amount)}</p>}
              </>
            ) : (
              <span className="whitespace-nowrap">{reais(c.amount)}</span>
            )}
            {varied && <span className={`block text-xs ${MUTED_CLS}`} data-range>{`${reais(c.minAmount)} – ${reais(c.maxAmount)}`}</span>}
          </td>
          <td className={`${TD_CLS} w-20`}>
            {canWrite ? (
              <>
                <input type="text" inputMode="numeric" value={r.dayText} disabled={busy} maxLength={2} aria-label={fillTemplate(t.detectRecAriaDay, { name: c.description })}
                  aria-invalid={r.errors.day ? true : undefined} className={INPUT_CLS} onChange={(e) => update((d) => setDayText(d, c.id, e.target.value))} />
                {r.errors.day && <p role="alert" className={ERROR_CLS}>{t.detectRecErrDay}</p>}
              </>
            ) : (
              <span>{c.dayOfMonth}</span>
            )}
          </td>
          <td className={`${TD_CLS} whitespace-nowrap`}>{fillTemplate(t.detectRecMonthsSeen, { seen: c.monthsSeen, window: c.windowMonths })}</td>
          <td className={`${TD_CLS} whitespace-nowrap`}>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${c.kind === 'bill' ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300'}`}>
              {c.kind === 'bill' ? t.detectRecChipBill : t.detectRecChipStable}
            </span>
          </td>
          <td className={`${TD_CLS} whitespace-nowrap`}>{confidenceText(c.confidence)}</td>
          <td className="px-3 py-2 align-top">
            <input type="checkbox" checked={r.followLast} disabled={busy || !canWrite} className={CHECKBOX_CLS} title={t.recurringFollowHelp}
              aria-label={`${t.recurringFollowLabel}: ${c.description}`} onChange={(e) => update((d) => setFollowLast(d, c.id, e.target.checked))} />
          </td>
        </tr>
        {isOpen && (
          <tr id={`${rowId}-examples`} data-examples={c.id}>
            <td colSpan={canWrite ? 9 : 8} className="px-3 py-2 bg-gray-50/60 dark:bg-gray-800/20">
              {c.examples.length === 0 ? (
                <p className={`text-xs ${MUTED_CLS}`}>{t.detectRecExamplesNone}</p>
              ) : (
                <ul className="text-xs space-y-1">
                  {c.examples.map((ex) => (
                    <li key={ex.transactionId} className="flex flex-wrap gap-x-3">
                      <span className={MUTED_CLS}>{formatDate(parseDateFromAPI(ex.date))}</span>
                      <span className="min-w-0 truncate max-w-[320px]" title={ex.description}>{ex.description}</span>
                      <span className="whitespace-nowrap">{reais(ex.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const requestClose = () => {
    if (!applying) onClose();
  };

  if (!open) return null;

  const wide = !(result || !candidates || list.length === 0);
  const createLabel = applying ? t.detectRecCreating : totals && totals.count > 0 ? fillTemplate(t.detectRecCreate, { count: totals.count }) : t.detectRecCreateNone;

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 transition-opacity" onClick={requestClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="detect-recurring-title"
          className={`relative w-full focus:outline-none ${wide ? 'max-w-6xl' : 'max-w-2xl'} p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              <Repeat className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />
              <h3 id="detect-recurring-title" className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">{t.detectRecTitle}</h3>
            </div>
            <button type="button" onClick={requestClose} disabled={applying} aria-label={t.close}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {result ? (
            <div className="space-y-4 min-w-0" data-step="result">
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">{t.detectRecResultTitle}</h4>
                {resultLines(result).length > 0 ? (
                  <ul className="mt-1 text-sm text-gray-900 dark:text-white list-disc list-inside space-y-1">
                    {resultLines(result).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                ) : <p className="mt-1 text-sm text-gray-900 dark:text-white">{t.detectRecResultNothing}</p>}
              </div>
              {result.warnings.length > 0 && (
                <ul className="rounded-md border border-yellow-200 dark:border-yellow-900/60 bg-yellow-50 dark:bg-yellow-900/20 px-4 py-3 text-sm text-yellow-800 dark:text-yellow-300 list-disc list-inside space-y-1 max-h-64 overflow-y-auto">
                  {result.warnings.map((w, i) => <li key={i}>{warningText(w)}</li>)}
                </ul>
              )}
              <div className="flex justify-end pt-2">
                <button type="button" onClick={onClose} autoFocus className={BTN_PRIMARY}>{t.close}</button>
              </div>
            </div>
          ) : loading ? (
            <p className={`text-sm ${MUTED_CLS}`} role="status">{t.detectRecLoading}</p>
          ) : candidates === null ? (
            <div className="space-y-4 min-w-0">
              <p role="alert" className={ERROR_CLS}>{detectError ?? t.detectRecFailed}</p>
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>{t.close}</button>
                <button type="button" onClick={() => void runDetect()} disabled={!householdId} className={BTN_PRIMARY}>{t.detectRecRetry}</button>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="space-y-4 min-w-0" data-step="empty">
              <p className="text-sm text-gray-900 dark:text-white">{t.detectRecEmpty}</p>
              {reasons.length > 0 && <p className={`text-xs ${MUTED_CLS}`}>{fillTemplate(t.detectRecLeftOut, { reasons: reasons.join(', ') })}</p>}
              <div className="flex gap-3 justify-end">
                <button type="button" onClick={onClose} className={BTN_SECONDARY}>{t.close}</button>
                <button type="button" onClick={() => void runDetect()} disabled={detecting || !householdId} className={BTN_SECONDARY}>
                  {detecting ? t.detectRecDetecting : t.detectRecAgain}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5 min-w-0" data-step="list">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={`text-sm ${MUTED_CLS}`}>
                  {fillTemplate(list.length === 1 ? t.detectRecIntroOne : t.detectRecIntroMany, { count: list.length })}
                  {canWrite ? ` ${t.detectRecIntroEdit}` : ''}
                </p>
                {detecting && (
                  <span className={`inline-flex items-center gap-1 text-xs ${MUTED_CLS}`} role="status">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    {t.detectRecUpdating}
                  </span>
                )}
              </div>

              {reasons.length > 0 && <p className={`text-xs ${MUTED_CLS}`}>{fillTemplate(t.detectRecLeftOut, { reasons: reasons.join(', ') })}</p>}

              {canWrite && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {groups.map((group) => {
                    const full = kindFullySelected(draft, list, group.kind);
                    const label = group.kind === 'bill'
                      ? (full ? t.detectRecUnselectBills : t.detectRecSelectBills)
                      : (full ? t.detectRecUnselectStable : t.detectRecSelectStable);
                    return (
                      <button key={group.kind} type="button" className={LINK_CLS} disabled={busy}
                        onClick={() => update((d) => setKindSelected(d, list, group.kind, !full))}>
                        {label}
                      </button>
                    );
                  })}
                  <button type="button" className={LINK_CLS} disabled={busy} title={t.recurringFollowHelp}
                    onClick={() => update((d) => setAllFollowLast(d, list, !allFollowLast(d, list)))}>
                    {allFollowLast(draft, list) ? t.detectRecFollowAllOff : t.detectRecFollowAllOn}
                  </button>
                </div>
              )}

              <div className={`space-y-5 min-w-0 transition-opacity ${detecting ? 'opacity-60' : ''}`} aria-busy={detecting}>
                {groups.map((group) => (
                  <section key={group.kind} aria-labelledby={`detect-group-${group.kind}`} className="space-y-2 min-w-0">
                    <h4 id={`detect-group-${group.kind}`} className="text-sm font-medium text-gray-900 dark:text-white">
                      {group.kind === 'bill' ? t.detectRecKindBill : t.detectRecKindStable} ({group.candidates.length})
                      {canWrite && (
                        <span className={`ml-2 text-xs font-normal ${MUTED_CLS}`}>
                          {fillTemplate(t.detectRecSelectedCount, { count: group.candidates.filter((c) => draft.selected[c.id] === true).length })}
                        </span>
                      )}
                    </h4>
                    <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800/50">
                            {canWrite && <th className={`${TH_CLS} w-8`} aria-label={t.detectRecColCreate} />}
                            <th className={TH_CLS}>{t.description}</th>
                            <th className={TH_CLS}>{t.account}</th>
                            <th className={TH_CLS}>{t.amount}</th>
                            <th className={TH_CLS}>{t.detectRecColDay}</th>
                            <th className={TH_CLS}>{t.detectRecColMonths}</th>
                            <th className={TH_CLS}>{t.type}</th>
                            <th className={TH_CLS}>{t.detectRecColConfidence}</th>
                            <th className={TH_CLS} title={t.recurringFollowHelp}>{t.detectRecColFollow}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">{group.candidates.map(renderRow)}</tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>

              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  {canWrite && totals ? (
                    <p className="text-sm text-gray-900 dark:text-white min-w-0" data-summary>
                      {totals.count === 0
                        ? t.detectRecNothingSelected
                        : fillTemplate(t.detectRecSummary, {
                            count: totals.count, stable: totals.stableCount, bills: totals.billCount, monthly: money(totals.monthlyCents), follow: totals.followCount,
                          })}
                    </p>
                  ) : <span />}
                  <div className="flex gap-3">
                    <button type="button" onClick={() => void runDetect()} disabled={busy || !householdId} className={BTN_SECONDARY}>
                      <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                      {t.detectRecAgain}
                    </button>
                    <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>{t.close}</button>
                    {canWrite && (
                      <button type="button" onClick={() => void handleApply()} disabled={busy || detecting || blocker !== null}
                        title={detecting ? t.detectRecWaitDetect : blocker ? blockerText(blocker) : undefined}
                        aria-describedby={blocker ? BLOCKER_ID : undefined} className={BTN_PRIMARY}>
                        {createLabel}
                      </button>
                    )}
                  </div>
                </div>
                {blocker && blocker !== 'applying' && (
                  <p id={BLOCKER_ID} className={`text-xs ${blocker === 'none-selected' ? MUTED_CLS : 'text-red-600 dark:text-red-400'}`}>{blockerText(blocker)}</p>
                )}
                {detectError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{detectError}</p>}
                {applyError && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-sm text-red-600 dark:text-red-400">{applyError}</p>
                    <button type="button" onClick={() => void runDetect()} disabled={busy} className={`${BTN_SECONDARY} !px-3 !py-1.5 !text-xs`}>{t.detectRecAgain}</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default DetectRecurringDialog;
