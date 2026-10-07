import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileUp, ReceiptText, X } from 'lucide-react';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useToastContext } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import type { Translations } from '../context/I18nContext';
import { TransactionType } from '../lib/enums';
import { formatCurrency, formatDate, parseDateFromAPI } from '../utils/format';
import CategoryCombobox from './CategoryCombobox';
import { isImportBusy, isImporterMissing, isTimeoutError } from '../utils/importStatement';
import {
  KIND_KEYS,
  MAX_RENDERED_LINES,
  PAYMENT_STATE_KEYS,
  SKIP_CAUSE_KEYS,
  SKIP_REASON_KEYS,
  STATUS_KEYS,
  WARNING_KEYS,
  CARD_OFX_MAX_FILE_BYTES,
  actionCounts,
  buildConfirmRequest,
  cardOfxFileProblem,
  categoryKey,
  defaultActions,
  isActionable,
  merchantsToImport,
  suggestedCategories,
  markCardOfxMissing,
  monthKeyLabel,
  monthLabel,
  parseMonthInput,
} from '../utils/cardOfx';
import type { CardOfxLineAction } from '../utils/cardOfx';
import { useCardOfxPreview } from '../hooks/api/useCardOfxPreview';
import type { CardOfxPreview, CardOfxStatus } from '../hooks/api/useCardOfxPreview';
import { useCardOfxConfirm } from '../hooks/api/useCardOfxConfirm';
import type { CardOfxConfirmResult } from '../hooks/api/useCardOfxConfirm';

interface ImportCardOfxDialogProps {
  open: boolean;
  onClose: () => void;
  /** The credit card the invoice belongs to. */
  account: { id: string; name: string };
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const STATUS_STYLES: Record<CardOfxStatus, string> = {
  new: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300',
  reconciled: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',
  payment: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300',
};

/**
 * Import of a credit card invoice (.ofx) in three steps: the file, the preview (which invoice month it is, what it
 * holds, which lines the app already has, and what to do with each new one), and the result. Nothing is saved before
 * the user confirms.
 */
const ImportCardOfxDialog = ({ open, onClose, account }: ImportCardOfxDialogProps) => {
  const { success, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();
  const { householdId } = useDefaultHousehold();
  const previewMutation = useCardOfxPreview();
  const confirmMutation = useCardOfxConfirm();

  const [file, setFile] = useState<File | null>(null);
  const [monthInput, setMonthInput] = useState('');
  const [preview, setPreview] = useState<CardOfxPreview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actions, setActions] = useState<Record<string, CardOfxLineAction>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CardOfxConfirmResult | null>(null);

  const isConfirming = confirmMutation.isPending;
  // Closing while the server is writing would hide the outcome (and the "stopped half way" message) from the user.
  const requestClose = useCallback(() => {
    if (!isConfirming) onClose();
  }, [isConfirming, onClose]);

  // Reset the state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setFile(null);
      setMonthInput('');
      setPreview(null);
      setFormError(null);
      setActions({});
      setCategories({});
      setResult(null);
    }
  }, [open, account.id]);

  // ESC + body scroll lock (same pattern as the statement import dialog).
  useEffect(() => {
    if (!open) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open, requestClose]);

  if (!open) return null;

  const isPreviewing = previewMutation.isPending;
  const money = (value: number) => formatCurrency(value, baseCurrency);

  const handleFileChange = (selected: File | null) => {
    setFormError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    const problem = cardOfxFileProblem(selected);
    if (problem) {
      setFormError(
        problem === 'format'
          ? t.cardOfxInvalidFormat
          : t.cardOfxTooLarge.replace('{max}', String(CARD_OFX_MAX_FILE_BYTES / (1024 * 1024))),
      );
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handlePreview = async () => {
    setFormError(null);
    if (!file) {
      setFormError(t.cardOfxSelectFile);
      return;
    }
    const monthOverride = parseMonthInput(monthInput);
    if (monthInput !== '' && !monthOverride) {
      setFormError(t.cardOfxMonthInvalid);
      return;
    }
    try {
      const result = await previewMutation.mutateAsync({ accountId: account.id, file, monthOverride });
      setPreview(result);
      setActions(defaultActions(result));
      setCategories(suggestedCategories(result));
    } catch (err: unknown) {
      if (isImporterMissing(err)) {
        markCardOfxMissing();
        showError(t.cardOfxUnavailable);
      } else if (isTimeoutError(err)) {
        showError(t.cardOfxTimeout);
      } else {
        showError(getErrorMessage(err, t.cardOfxPreviewFailed));
      }
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setFormError(null);
    if (counts.import + counts.link === 0) {
      setFormError(t.cardOfxNothingToImport);
      return;
    }
    try {
      const outcome = await confirmMutation.mutateAsync(buildConfirmRequest(preview, actions, categories));
      setResult(outcome);
      if (outcome.stoppedAt) {
        showError(t.cardOfxResultStopped);
      } else {
        success(t.cardOfxResultTitle);
      }
    } catch (err: unknown) {
      // 409: another import of this card is running; nothing was done here, the selection stays as it is.
      if (isImportBusy(err)) showError(t.cardOfxConfirmBusy);
      // No answer is not "nothing imported": the server may still be saving lines.
      else showError(isTimeoutError(err) ? t.cardOfxConfirmTimeout : getErrorMessage(err, t.cardOfxConfirmFailed));
    }
  };

  const setAction = (ref: string, action: CardOfxLineAction) => setActions((current) => ({ ...current, [ref]: action }));

  const label = (key: keyof Translations) => t[key] as string;
  const counts = actionCounts(actions);
  const merchants = preview ? merchantsToImport(preview, actions) : [];

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={requestClose}
        aria-hidden="true"
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="card-ofx-title"
          className="relative w-full sm:w-[720px] max-w-3xl p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              <ReceiptText className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0" aria-hidden="true" />
              <h3 id="card-ofx-title" className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">
                {t.cardOfxTitle.replace('{card}', account.name)}
              </h3>
            </div>
            <button
              onClick={requestClose}
              disabled={isConfirming}
              aria-label={t.close}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          {formError && (
            <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
              {formError}
            </p>
          )}

          {preview === null ? (
            <div className="space-y-4 min-w-0">
              <div>
                <label htmlFor="card-ofx-file" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t.cardOfxFile}
                </label>
                <input
                  id="card-ofx-file"
                  type="file"
                  accept=".ofx"
                  disabled={isPreviewing}
                  onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm text-gray-700 dark:text-gray-200 file:mr-4 file:py-2.5 file:px-4 file:rounded-md file:border file:border-gray-200 dark:file:border-gray-800 file:text-sm file:font-light file:bg-gray-50 dark:file:bg-gray-800 file:text-gray-900 dark:file:text-white hover:file:opacity-80 disabled:opacity-50"
                />
                {file && (
                  <p className="mt-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <FileUp className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    <span className="truncate">{file.name}</span>
                  </p>
                )}
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.cardOfxHint}</p>
              </div>

              <div>
                <label htmlFor="card-ofx-month" className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  {t.cardOfxMonth}
                </label>
                <input
                  id="card-ofx-month"
                  type="month"
                  value={monthInput}
                  min="2000-01"
                  max="2100-12"
                  disabled={isPreviewing}
                  onChange={(e) => setMonthInput(e.target.value)}
                  className="px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t.cardOfxMonthHint}</p>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={requestClose}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:opacity-70 transition-opacity"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={isPreviewing || !file}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPreviewing ? t.cardOfxAnalyzing : t.cardOfxPreview}
                </button>
              </div>
            </div>
          ) : result !== null ? (
            <div className="space-y-4 min-w-0">
              <p className="font-medium text-gray-700 dark:text-gray-200">{t.cardOfxResultTitle}</p>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.new}`}>
                  {t.cardOfxResultCreated.replace('{count}', String(result.created))}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.payment}`}>
                  {t.cardOfxResultLinked.replace('{count}', String(result.linked))}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.reconciled}`}>
                  {t.cardOfxResultSkipped.replace('{count}', String(result.skipped.length))}
                </span>
              </div>
              {result.stoppedAt && (
                <div className="space-y-2">
                  <p role="alert" className="text-sm text-red-600 dark:text-red-400">
                    {t.cardOfxResultStopped}
                  </p>
                  <button
                    type="button"
                    onClick={handleConfirm}
                    disabled={isConfirming}
                    className="px-4 py-2.5 text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:opacity-70 transition-opacity disabled:opacity-50"
                  >
                    {isConfirming ? t.cardOfxConfirming : t.cardOfxRetry}
                  </button>
                </div>
              )}
              {result.skipped.length > 0 && (
                <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc pl-5 max-h-40 overflow-y-auto">
                  {result.skipped.map((item) => {
                    const line = preview?.lines.find((l) => l.ref === item.ref);
                    return (
                      <li key={item.ref}>
                        {line?.memo ?? item.ref}: {label(SKIP_CAUSE_KEYS[item.cause])}
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={requestClose}
                  disabled={isConfirming}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  {t.close}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 min-w-0">
              <div className="text-sm text-gray-700 dark:text-gray-200 space-y-1">
                <p className="font-medium">
                  {(preview.monthSource === 'override' ? t.cardOfxMonthChosen : t.cardOfxMonthFromFile).replace(
                    '{month}',
                    monthLabel(preview.month),
                  )}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {t.cardOfxPeriod
                    .replace('{start}', formatDate(parseDateFromAPI(preview.period.start)))
                    .replace('{end}', formatDate(parseDateFromAPI(preview.period.end)))}
                </p>
                <p className="text-gray-600 dark:text-gray-400">
                  {t.cardOfxTotal.replace('{amount}', money(preview.ofxTotal))}
                  {preview.ledgerBalance !== null &&
                    ` · ${t.cardOfxLedger.replace('{amount}', money(preview.ledgerBalance))}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.new}`}>
                  {t.cardOfxCountNew.replace('{count}', String(preview.totals.new))}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.reconciled}`}>
                  {t.cardOfxCountReconciled.replace('{count}', String(preview.totals.reconciled))}
                </span>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLES.payment}`}>
                  {t.cardOfxCountPayments.replace('{count}', String(preview.totals.payments))}
                </span>
              </div>

              {preview.warnings.length > 0 && (
                <ul
                  role="alert"
                  className="text-sm text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-md px-3 py-2 space-y-1"
                >
                  {preview.warnings.map((warning) => (
                    <li key={warning}>{label(WARNING_KEYS[warning])}</li>
                  ))}
                </ul>
              )}

              {preview.payment && (
                <div className="text-sm rounded-md border border-gray-200 dark:border-gray-800 px-3 py-2">
                  <p className="font-medium text-gray-700 dark:text-gray-200">
                    {t.cardOfxPaymentTitle.replace('{month}', monthKeyLabel(preview.payment.invoiceMonthKey))}
                  </p>
                  <p className="mt-1 text-gray-600 dark:text-gray-400">
                    {label(PAYMENT_STATE_KEYS[preview.payment.state])
                      .replace('{statement}', money(preview.payment.statementTotal))
                      .replace('{recorded}', money(preview.payment.recordedTotal))}
                  </p>
                </div>
              )}

              {preview.totals.skipped > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-700 dark:text-gray-200">
                    {t.cardOfxSkippedTitle.replace('{count}', String(preview.totals.skipped))}
                  </p>
                  <ul className="mt-1 list-disc pl-5 max-h-28 overflow-y-auto">
                    {preview.skipped.map((item) => (
                      <li key={`${item.position}-${item.reason}`}>
                        {t.cardOfxSkipLine
                          .replace('{position}', String(item.position))
                          .replace('{reason}', label(SKIP_REASON_KEYS[item.reason]))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{t.date}</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{t.description}</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200 text-right">{t.amount}</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{t.type}</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{t.cardOfxStatus}</th>
                      <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">{t.cardOfxAction}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {preview.lines.slice(0, MAX_RENDERED_LINES).map((line) => {
                      const kindKey = KIND_KEYS[line.kind];
                      return (
                        <tr key={line.ref}>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                            {formatDate(parseDateFromAPI(line.date))}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[240px]" title={line.memo}>
                            <span className="block truncate">{line.memo}</span>
                            {line.possibleDuplicate && (
                              <span className="block text-xs text-yellow-800 dark:text-yellow-300">
                                {t.cardOfxDuplicateNote
                                  .replace('{description}', line.possibleDuplicate.description ?? '')
                                  .replace('{date}', formatDate(parseDateFromAPI(line.possibleDuplicate.date)))}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-gray-900 dark:text-white">
                            {money(line.amount)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {line.type === 'INCOME' ? t.income : t.expense}
                            {kindKey && ` · ${label(kindKey)}`}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[line.status]}`}>
                              {label(STATUS_KEYS[line.status])}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {isActionable(line) && (
                              <select
                                aria-label={`${t.cardOfxAction}: ${line.memo}`}
                                value={actions[line.ref] ?? 'skip'}
                                disabled={isConfirming}
                                onChange={(e) => setAction(line.ref, e.target.value as CardOfxLineAction)}
                                className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                              >
                                <option value="import">{t.cardOfxActionImport}</option>
                                <option value="skip">{t.cardOfxActionSkip}</option>
                                {line.possibleDuplicate && <option value="link">{t.cardOfxActionLink}</option>}
                              </select>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {preview.lines.length > MAX_RENDERED_LINES && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.cardOfxMoreLines
                    .replace('{shown}', String(MAX_RENDERED_LINES))
                    .replace('{total}', String(preview.lines.length))}
                </p>
              )}

              {merchants.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{t.cardOfxCategoriesTitle}</p>
                  <ul className="space-y-2">
                    {merchants.map(({ merchant, type }) => (
                      <li key={categoryKey(type, merchant)} className="flex items-center gap-3 min-w-0">
                        <span className="flex-1 min-w-0 truncate text-sm text-gray-900 dark:text-white" title={merchant}>
                          {merchant}
                        </span>
                        <div className="w-56 flex-shrink-0">
                          <CategoryCombobox
                            value={categories[categoryKey(type, merchant)] ?? ''}
                            onValueChange={(value) => setCategories((current) => ({ ...current, [categoryKey(type, merchant)]: value }))}
                            type={type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE}
                            householdId={householdId ?? undefined}
                            disabled={isConfirming}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">{t.cardOfxPreviewOnly}</p>

              <div className="flex gap-3 justify-between pt-2">
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => {
                    setPreview(null);
                    setFormError(null);
                  }}
                  className="inline-flex items-center px-4 py-2.5 text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:opacity-70 transition-opacity"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t.back}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isConfirming || counts.import + counts.link === 0}
                  title={counts.import + counts.link === 0 ? t.cardOfxNothingToImport : undefined}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? t.cardOfxConfirming : `${t.cardOfxConfirm} (${counts.import + counts.link})`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default ImportCardOfxDialog;
