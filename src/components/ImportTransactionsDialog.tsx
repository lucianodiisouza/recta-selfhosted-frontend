import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, FileUp, Upload, X } from 'lucide-react';
import { useAccounts } from '../hooks/api/useAccounts';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useToastContext } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { formatCurrency, formatDate, parseDateFromAPI } from '../utils/format';
import {
  MAX_RENDERED_ROWS,
  SKIP_REASON_KEYS,
  isImportBusy,
  isImporterMissing,
  isTimeoutError,
  isStatementFile,
  markImporterMissing,
  previewCounts,
  rowsToConfirm,
} from '../utils/importStatement';

import {
  useImportPreview,
  useConfirmImport,
} from '../hooks/api/useImportTransactions';
import type { ImportPreview } from '../hooks/api/useImportTransactions';

interface ImportTransactionsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Defaults to the user's default household (same pattern as Transactions.tsx). */
  householdId?: string;
  defaultAccountId?: string | null;
}

const getErrorMessage = (err: unknown, fallback: string): string =>
  err instanceof Error && err.message ? err.message : fallback;

const ImportTransactionsDialog = ({
  open,
  onClose,
  householdId: householdIdProp,
  defaultAccountId,
}: ImportTransactionsDialogProps) => {
  const { householdId: defaultHouseholdId } = useDefaultHousehold();
  const householdId = householdIdProp ?? defaultHouseholdId;
  const { success, error: showError } = useToastContext();
  const { baseCurrency } = useCurrency();
  const { t } = useI18n();

  const { data: accountsData, isLoading: isLoadingAccounts } = useAccounts({
    householdId: householdId ?? '',
  });
  const accounts = accountsData?.accounts ?? [];

  // Query invalidation after success lives in the hooks (onSuccess); the dialog only closes and shows the toast.
  const previewMutation = useImportPreview();
  const confirmMutation = useConfirmImport();

  const [accountId, setAccountId] = useState<string>(defaultAccountId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset the state whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setAccountId(defaultAccountId ?? '');
      setFile(null);
      setPreview(null);
      setFormError(null);
    }
  }, [open, defaultAccountId]);

  const isConfirming = confirmMutation.isPending;
  // Closing while the server is writing would hide the outcome (and the "stopped half way" message) from the user.
  const requestClose = useCallback(() => {
    if (!isConfirming) onClose();
  }, [isConfirming, onClose]);

  // ESC + body scroll lock (same pattern as ConfirmModal/TransactionModal).
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
  const handleFileChange = (selected: File | null) => {
    setFormError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (!isStatementFile(selected.name)) {
      setFormError(t.importStatementInvalidFormat);
      setFile(null);
      return;
    }
    setFile(selected);
  };

  const handlePreview = async () => {
    setFormError(null);
    if (!householdId) {
      setFormError(t.importStatementNoHousehold);
      return;
    }
    if (!accountId) {
      setFormError(t.importStatementSelectAccount);
      return;
    }
    if (!file) {
      setFormError(t.importStatementSelectFile);
      return;
    }
    try {
      const result = await previewMutation.mutateAsync({ accountId, file });
      setPreview(result);
    } catch (err: unknown) {
      if (isImporterMissing(err)) {
        markImporterMissing();
        showError(t.importStatementUnavailable);
        return;
      }
      showError(getErrorMessage(err, t.importStatementPreviewFailed));
    }
  };

  const handleConfirm = async () => {
    if (!preview) return;
    setFormError(null);
    if (!householdId || !accountId) {
      setFormError(t.importStatementSelectAccount);
      return;
    }
    if (newCount === 0) return;
    const fileRows = rowsToConfirm(preview.rows);
    try {
      const result = await confirmMutation.mutateAsync({ accountId, rows: fileRows });
      const imported = result?.imported ?? newCount;
      if (result?.error) {
        // Some rows were saved before a failure: keep the dialog open so the message is read, and let the user run it again.
        showError(
          t.importStatementPartial.replace('{count}', String(imported)).replace('{error}', result.error),
        );
        return;
      }
      success(
        imported === 1
          ? t.importStatementImportedOne
          : t.importStatementImportedMany.replace('{count}', String(imported)),
      );
      onClose();
    } catch (err: unknown) {
      if (isImportBusy(err)) {
        showError(t.importStatementBusy);
      } else if (isTimeoutError(err)) {
        // No answer is not "nothing imported": the server may still be saving rows.
        showError(t.importStatementTimeout);
      } else {
        showError(getErrorMessage(err, t.importStatementConfirmFailed));
      }
    }
  };

  const handleBack = () => {
    setPreview(null);
    setFormError(null);
  };

  const rows = preview?.rows ?? [];
  const skippedLines = preview?.skipped ?? [];
  const skippedCount = preview?.skippedCount ?? skippedLines.length;
  const { newCount, duplicateCount } = preview
    ? previewCounts(preview)
    : { newCount: 0, duplicateCount: 0 };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out"
        onClick={requestClose}
        aria-hidden="true"
      />

      {/* Scrollable Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[640px] max-w-2xl p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              <Upload
                className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-3 flex-shrink-0"
                aria-hidden="true"
              />
              <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">
                {t.importStatementTitle}
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
            /* Step 1: destination account + file */
            <div className="space-y-4 min-w-0">
              <div>
                <label
                  htmlFor="import-account"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  {t.importStatementAccount}
                </label>
                <select
                  id="import-account"
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  disabled={isLoadingAccounts || isPreviewing || !householdId}
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  <option value="">
                    {isLoadingAccounts ? t.importStatementLoadingAccounts : t.importStatementChooseAccount}
                  </option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="import-file"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  {t.importStatementFile}
                </label>
                <input
                  ref={fileInputRef}
                  id="import-file"
                  type="file"
                  accept=".csv,.ofx"
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
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t.importStatementHint}
                </p>
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
                  disabled={isPreviewing || !accountId || !file || !householdId}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPreviewing ? t.importStatementAnalyzing : t.importStatementPreview}
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: preview */
            <div className="space-y-4 min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 font-medium">
                  {(newCount === 1 ? t.importStatementNewOne : t.importStatementNewMany).replace('{count}', String(newCount))}
                </span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300 font-medium">
                  {(duplicateCount === 1 ? t.importStatementDuplicateOne : t.importStatementDuplicateMany).replace(
                    '{count}',
                    String(duplicateCount),
                  )}
                </span>
              </div>

              {preview.warnings?.includes('card-statement') && (
                <p
                  role="alert"
                  className="text-sm text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 rounded-md px-3 py-2"
                >
                  {t.importStatementCardWarning}
                </p>
              )}

              {skippedCount > 0 && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-700 dark:text-gray-200">
                    {t.importStatementSkippedTitle.replace('{count}', String(skippedCount))}
                  </p>
                  <ul className="mt-1 list-disc pl-5 max-h-28 overflow-y-auto">
                    {skippedLines.map((item) => (
                      <li key={`${item.line}-${item.reason}`}>
                        {t.importStatementSkipLine
                          .replace('{line}', String(item.line))
                          .replace('{reason}', t[SKIP_REASON_KEYS[item.reason]] ?? item.reason)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {rows.length === 0 ? (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {t.importStatementEmpty}
                </p>
              ) : (
                <div className="overflow-x-auto border border-gray-200 dark:border-gray-800 rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-gray-800/50 text-left">
                        <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">
                          {t.date}
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">
                          {t.description}
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200 text-right">
                          {t.amount}
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">
                          {t.type}
                        </th>
                        <th className="px-3 py-2 font-medium text-gray-700 dark:text-gray-200">
                          {t.importStatementStatus}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {rows.slice(0, MAX_RENDERED_ROWS).map((row) => (
                        <tr
                          key={row.index}
                          className={
                            row.duplicate
                              ? 'bg-yellow-50/50 dark:bg-yellow-900/10'
                              : undefined
                          }
                        >
                          <td className="px-3 py-2 whitespace-nowrap text-gray-900 dark:text-white">
                            {formatDate(parseDateFromAPI(row.date))}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-white max-w-[220px] truncate">
                            {row.description}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-right text-gray-900 dark:text-white">
                            {formatCurrency(row.amount, baseCurrency)}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-400">
                            {row.type === 'INCOME' ? t.income : t.expense}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {row.duplicate ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-300">
                                {t.importStatementRowDuplicate}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {t.importStatementRowNew}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rows.length > MAX_RENDERED_ROWS && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t.importStatementMoreRows
                    .replace('{shown}', String(MAX_RENDERED_ROWS))
                    .replace('{total}', String(rows.length))}
                </p>
              )}

              <div className="flex gap-3 justify-between pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isConfirming}
                  className="inline-flex items-center px-4 py-2.5 text-sm font-light tracking-tight text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md hover:opacity-70 transition-opacity disabled:opacity-50"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" aria-hidden="true" />
                  {t.back}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={isConfirming || newCount === 0}
                  title={newCount === 0 ? t.importStatementNothingNew : undefined}
                  className="px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? t.importStatementImporting : t.importStatementConfirm}
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

export default ImportTransactionsDialog;
