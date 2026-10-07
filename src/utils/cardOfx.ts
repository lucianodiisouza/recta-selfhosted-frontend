import type {
  CardOfxKind,
  CardOfxPaymentState,
  CardOfxSkipReason,
  CardOfxStatus,
  CardOfxWarning,
} from '../hooks/api/useCardOfxPreview';

/** What POST /transactions/import/card-ofx/preview takes: one .ofx file up to 5 MB. */
export const CARD_OFX_MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Lines drawn in the preview table; the rest exist, the table only says how many are hidden. */
export const MAX_RENDERED_LINES = 200;

export function isOfxFileName(name: string): boolean {
  return name.toLowerCase().endsWith('.ofx');
}

export type CardOfxFileProblem = 'format' | 'size';

/** Why a chosen file cannot be sent, so the dialog says so before uploading; null when it can. */
export function cardOfxFileProblem(file: { name: string; size: number }): CardOfxFileProblem | null {
  if (!isOfxFileName(file.name)) return 'format';
  return file.size > CARD_OFX_MAX_FILE_BYTES ? 'size' : null;
}

/**
 * The invoice month typed in a `<input type="month">` ('YYYY-MM') as the server takes it; undefined when the field is
 * empty or holds something the server would refuse (it accepts 2000 to 2100).
 */
export function parseMonthInput(value: string): { year: number; month: number } | undefined {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  return year >= 2000 && year <= 2100 ? { year, month: Number(match[2]) } : undefined;
}

/** 'MM/YYYY' of a month, the way the invoice month is written in the messages. */
export function monthLabel(month: { year: number; month: number }): string {
  return `${String(month.month).padStart(2, '0')}/${month.year}`;
}

/** 'MM/YYYY' of a 'YYYY-MM' key. */
export function monthKeyLabel(key: string): string {
  const [year, month] = key.split('-');
  return `${month}/${year}`;
}

// Translation key of the message for each code the server can answer with. `satisfies` makes the compiler list any
// code the contract gains and this table lacks.
export const WARNING_KEYS = {
  'multiple-statements': 'cardOfxWarningMultipleStatements',
  'period-end-missing': 'cardOfxWarningPeriodEndMissing',
  'card-without-due-day': 'cardOfxWarningCardWithoutDueDay',
  'card-without-closing-day': 'cardOfxWarningCardWithoutClosingDay',
  'balance-mismatch': 'cardOfxWarningBalanceMismatch',
} as const satisfies Record<CardOfxWarning, string>;

export const SKIP_REASON_KEYS = {
  'invalid-amount': 'cardOfxSkipInvalidAmount',
  'zero-amount': 'cardOfxSkipZeroAmount',
  'amount-too-large': 'cardOfxSkipAmountTooLarge',
  'invalid-date': 'cardOfxSkipInvalidDate',
  'missing-id': 'cardOfxSkipMissingId',
  'id-too-long': 'cardOfxSkipIdTooLong',
} as const satisfies Record<CardOfxSkipReason, string>;

export const STATUS_KEYS = {
  new: 'cardOfxStatusNew',
  payment: 'cardOfxStatusPayment',
} as const satisfies Record<CardOfxStatus, string>;

/** A purchase needs no label: the type column already says expense. */
export const KIND_KEYS = {
  purchase: null,
  refund: 'cardOfxKindRefund',
  discount: 'cardOfxKindDiscount',
  payment: null,
} as const satisfies Record<CardOfxKind, string | null>;

export const PAYMENT_STATE_KEYS = {
  matches: 'cardOfxPaymentMatches',
  differs: 'cardOfxPaymentDiffers',
  missing: 'cardOfxPaymentMissing',
  undetermined: 'cardOfxPaymentUndetermined',
} as const satisfies Record<CardOfxPaymentState, string>;

// The importer is probed by use: the first 404 from the server hides the entry point for the rest of the session, so a
// backend without the feature does not keep offering a button that cannot work.
let importerMissing = false;
const listeners = new Set<() => void>();

export function markCardOfxMissing(): void {
  if (importerMissing) return;
  importerMissing = true;
  listeners.forEach((listener) => listener());
}

export function subscribeCardOfxMissing(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getCardOfxMissing = (): boolean => importerMissing;

/** Test hook: the flag otherwise lives for the whole page session. */
export function resetCardOfxMissing(): void {
  importerMissing = false;
  listeners.forEach((listener) => listener());
}
