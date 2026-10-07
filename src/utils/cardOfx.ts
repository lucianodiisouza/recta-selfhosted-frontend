import type { CardOfxConfirmRequest, CardOfxSkipCause } from '../hooks/api/useCardOfxConfirm';
import type {
  CardOfxKind,
  CardOfxLine,
  CardOfxPreview,
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
  'possible-duplicates': 'cardOfxWarningPossibleDuplicates',
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
  reconciled: 'cardOfxStatusReconciled',
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

// ---------------------------------------------------------------------------
// What to do with each line
// ---------------------------------------------------------------------------

/** import: create a transaction; skip: leave it out; link: record it as represented by the look-alike transaction. */
export type CardOfxLineAction = 'import' | 'skip' | 'link';

/** A line the user can decide about: new, and not a payment. */
export function isActionable(line: Pick<CardOfxLine, 'status' | 'kind'>): boolean {
  return line.status === 'new' && line.kind !== 'payment';
}

/** Key of a merchant category: the same merchant can be a purchase and a refund. */
export function categoryKey(type: 'INCOME' | 'EXPENSE', merchant: string): string {
  return `${type}|${merchant}`;
}

/** New lines are imported; the ones that look like a hand-typed transaction are skipped until the user decides. */
export function defaultActions(preview: Pick<CardOfxPreview, 'lines'>): Record<string, CardOfxLineAction> {
  const actions: Record<string, CardOfxLineAction> = {};
  for (const line of preview.lines) {
    if (isActionable(line)) actions[line.ref] = line.possibleDuplicate ? 'skip' : 'import';
  }
  return actions;
}

/** The category the household last gave each merchant, by categoryKey. */
export function suggestedCategories(preview: Pick<CardOfxPreview, 'categorySuggestions'>): Record<string, string> {
  return Object.fromEntries(preview.categorySuggestions.map((s) => [categoryKey(s.type, s.merchant), s.categoryName]));
}

export function actionCounts(actions: Readonly<Record<string, CardOfxLineAction>>): { import: number; link: number; skip: number } {
  const counts = { import: 0, link: 0, skip: 0 };
  for (const action of Object.values(actions)) counts[action] += 1;
  return counts;
}

/** Merchants whose lines are going to be created, once each per direction, in line order. */
export function merchantsToImport(
  preview: Pick<CardOfxPreview, 'lines'>,
  actions: Readonly<Record<string, CardOfxLineAction>>,
): Array<{ merchant: string; type: 'INCOME' | 'EXPENSE' }> {
  const seen = new Set<string>();
  const out: Array<{ merchant: string; type: 'INCOME' | 'EXPENSE' }> = [];
  for (const line of preview.lines) {
    const key = categoryKey(line.type, line.merchant);
    if (actions[line.ref] !== 'import' || seen.has(key)) continue;
    seen.add(key);
    out.push({ merchant: line.merchant, type: line.type });
  }
  return out;
}

/**
 * The confirm request: every preview line echoed (the server checks them against their own content), the lines to
 * create, the ones to create although they look like a hand-typed transaction, the links, and the category of each
 * merchant that has one.
 */
export function buildConfirmRequest(
  preview: Pick<CardOfxPreview, 'accountId' | 'lines'>,
  actions: Readonly<Record<string, CardOfxLineAction>>,
  categories: Readonly<Record<string, string>>,
): CardOfxConfirmRequest {
  const lines = preview.lines.map(({ status: _status, possibleDuplicate: _duplicate, ...line }) => line);
  const importing = preview.lines.filter((l) => actions[l.ref] === 'import');
  const links = preview.lines.flatMap((l) =>
    actions[l.ref] === 'link' && l.possibleDuplicate ? [{ ref: l.ref, transactionId: l.possibleDuplicate.transactionId }] : [],
  );
  const categoryMap = merchantsToImport(preview, actions).flatMap(({ merchant, type }) => {
    const categoryName = categories[categoryKey(type, merchant)];
    return categoryName ? [{ merchant, type, categoryName }] : [];
  });
  return {
    accountId: preview.accountId,
    lines,
    selectedRefs: importing.map((l) => l.ref),
    createDespiteDuplicate: importing.filter((l) => l.possibleDuplicate).map((l) => l.ref),
    links,
    categoryMap,
  };
}

// Translation key of the reason a selected line was left out.
export const SKIP_CAUSE_KEYS = {
  'already-imported': 'cardOfxCauseAlreadyImported',
  'possible-duplicate': 'cardOfxCausePossibleDuplicate',
  'link-refused': 'cardOfxCauseLinkRefused',
} as const satisfies Record<CardOfxSkipCause, string>;
