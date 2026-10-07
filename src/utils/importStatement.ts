import type {
  ConfirmImportRow,
  ImportPreview,
  ImportPreviewRow,
  ImportSkipReason,
} from '../hooks/api/useImportTransactions';

/** Extensions the backend statement importer reads. Keep in sync with POST /transactions/import/preview. */
export const STATEMENT_EXTENSIONS = ['.csv', '.ofx'] as const;

export function isStatementFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return STATEMENT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Rows to send on confirm: ALL of the file, duplicates included. The server decides which ones are already on the
 * account by counting occurrences over the whole list (the Nth identical row is a duplicate only when the account
 * already has N). Sending just the rows the preview called new would make the server count over a subset: with 3
 * identical rows in the file and 1 on the account, the 2 "new" ones would be seen as 1 stored + 1 new and one would be
 * lost. Sending the same list keeps preview and confirm in agreement, also when an import is run again after it
 * stopped half way. Preview-only fields (index, duplicate) are dropped.
 */
export function rowsToConfirm(rows: readonly ImportPreviewRow[]): ConfirmImportRow[] {
  return rows.map(({ date, description, amount, type }) => ({ date, description, amount, type }));
}

/** Counts shown in the preview badges; trusts the server totals and recomputes them if the response omits them. */
export function previewCounts(preview: ImportPreview): { newCount: number; duplicateCount: number } {
  const duplicates = preview.rows.filter((row) => row.duplicate).length;
  return {
    newCount: preview.newCount ?? preview.rows.length - duplicates,
    duplicateCount: preview.duplicateCount ?? duplicates,
  };
}

/**
 * True when the server has no importer at all (an older backend without the route). The app answers every error with
 * a code (a missing account is `NOT_FOUND`); a 404 or 405 without one comes from the framework's own router, so it is
 * the route that is missing, not the account.
 */
export function isImporterMissing(error: unknown): boolean {
  const { status, code } = (error as { status?: unknown; code?: unknown } | null) ?? {};
  return (status === 404 || status === 405) && code === undefined;
}

/** The server refuses a second confirm on the same account while one is running (409 CONFLICT). */
export function isImportBusy(error: unknown): boolean {
  return (error as { status?: unknown } | null)?.status === 409;
}

/**
 * The request gave up waiting (no HTTP status at all). It says nothing about the server: the import may still be
 * running there, so the message must not claim that nothing was imported.
 */
export function isTimeoutError(error: unknown): boolean {
  const { status, message } = (error as { status?: unknown; message?: unknown } | null) ?? {};
  return status === undefined && typeof message === 'string' && /timeout/i.test(message);
}

/**
 * Time to wait for a confirm: the server saves about 25 ms per row, so the default 30 s of the shared client is far too
 * short for a big file. 100 ms per row on top of 30 s leaves a wide margin, capped at 5 minutes.
 */
export function confirmTimeoutMs(rowCount: number): number {
  return Math.min(5 * 60_000, 30_000 + rowCount * 100);
}

/** Rows drawn in the preview table; the rest are still imported, the table only says how many are hidden. */
export const MAX_RENDERED_ROWS = 200;

/** Translation key of the message for each reason the server can give for a skipped line. */
export const SKIP_REASON_KEYS = {
  'invalid-date': 'importStatementSkipInvalidDate',
  'invalid-amount': 'importStatementSkipInvalidAmount',
  'ambiguous-amount': 'importStatementSkipAmbiguousAmount',
  'column-count': 'importStatementSkipColumnCount',
  'repeated-id': 'importStatementSkipRepeatedId',
} as const satisfies Record<ImportSkipReason, string>;

// The importer is probed by use: the first 404 from the server hides the entry point for the rest of the session, so
// a backend without the feature does not keep offering a button that cannot work.
let importerMissing = false;
const listeners = new Set<() => void>();

export function markImporterMissing(): void {
  if (importerMissing) return;
  importerMissing = true;
  listeners.forEach((listener) => listener());
}

export function subscribeImporterMissing(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getImporterMissing = (): boolean => importerMissing;

/** Test hook: the flag otherwise lives for the whole page session. */
export function resetImporterMissing(): void {
  importerMissing = false;
  listeners.forEach((listener) => listener());
}
