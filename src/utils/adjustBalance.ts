// Pure logic of the "Adjust balance" dialog. Money is integer cents everywhere here; the wire number is cents / 100
// (exact: the division is correctly rounded), which the server accepts with at most two decimals.
// Nothing here produces user-facing text: validation returns error codes and the money field is formatted by the caller,
// so the dialog translates everything through the i18n files.

/** Largest typed amount: 12 digits of cents (9,999,999,999.99), far below the server limit (1e12). */
export const MAX_ADJUST_DIGITS = 12;
/** Server limit of the reason (accounts.schema.ts adjustBalanceSchema). */
export const MAX_REASON_LENGTH = 255;

export interface MaskedMoney {
  /** Typed amount in cents (negative when the text has a minus sign); null while no digit was typed. */
  cents: number | null;
  /** What the field shows: the formatted amount, "-" (sign only) or "". */
  display: string;
}

/**
 * Digits only, filled from the right like a bank terminal; a "-" anywhere makes it negative. `format` renders cents in
 * the user's currency and locale (without a sign); because only digits are read back, the field's own output parses to
 * the same value.
 */
export function maskMoneyInput(text: string, format: (cents: number) => string): MaskedMoney {
  const negative = text.includes('-');
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, MAX_ADJUST_DIGITS);
  if (!digits) return { cents: null, display: negative ? '-' : '' };
  const abs = Number(digits);
  return { cents: negative && abs !== 0 ? -abs : abs, display: `${negative ? '-' : ''}${format(abs)}` };
}

/** Reais from the API to integer cents (rounds the float noise of 3665.04 * 100). */
export function reaisToCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100 + (value < 0 ? -1e-6 : 1e-6)) : 0;
}

/** Today as YYYY-MM-DD in local time. */
export function todayIsoDate(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/** The last day of the previous year, the suggested date of an opening balance. */
export function lastDayOfPreviousYear(now: Date = new Date()): string {
  return `${now.getFullYear() - 1}-12-31`;
}

/** A real calendar day written YYYY-MM-DD (2025-02-30 is not). */
export function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const parsed = new Date(y, mo - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === mo - 1 && parsed.getDate() === d;
}

/** YYYY-MM-DD in the locale's date format, built from local parts so the UTC-midnight day shift cannot happen. */
export function formatIsoDate(value: string, locale: string): string {
  if (!isValidIsoDate(value)) return value;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d).toLocaleDateString(locale);
}

/** An opening balance is an adjustment dated before the current year; anything else is a plain adjustment. */
export type AdjustReasonKind = 'opening' | 'adjust';

export function adjustReasonKind(date: string, now: Date = new Date()): AdjustReasonKind {
  return isValidIsoDate(date) && date < `${now.getFullYear()}-01-01` ? 'opening' : 'adjust';
}

export interface AdjustInput {
  /** Current total balance of the account, in cents. */
  currentCents: number;
  /** Target balance in cents; null while nothing was typed. */
  targetCents: number | null;
  date: string;
  reason: string;
}

export type AdjustErrorCode = 'targetRequired' | 'sameBalance' | 'dateRequired' | 'dateInvalid' | 'dateFuture' | 'reasonTooLong';

export interface AdjustCheck {
  ok: boolean;
  /** target - current, in cents (null while the target is missing). Positive: an income entry; negative: an expense. */
  differenceCents: number | null;
  errors: { target?: AdjustErrorCode; date?: AdjustErrorCode; reason?: AdjustErrorCode };
}

export function validateAdjust(input: AdjustInput, now: Date = new Date()): AdjustCheck {
  const errors: AdjustCheck['errors'] = {};
  const differenceCents = input.targetCents === null ? null : input.targetCents - input.currentCents;
  if (input.targetCents === null) errors.target = 'targetRequired';
  else if (differenceCents === 0) errors.target = 'sameBalance';
  if (!input.date) errors.date = 'dateRequired';
  else if (!isValidIsoDate(input.date)) errors.date = 'dateInvalid';
  else if (input.date > todayIsoDate(now)) errors.date = 'dateFuture';
  if (input.reason.trim().length > MAX_REASON_LENGTH) errors.reason = 'reasonTooLong';
  return { ok: Object.keys(errors).length === 0, differenceCents, errors };
}

export interface AdjustBody {
  newBalance: number;
  date: string;
  reason: string;
}

/**
 * The request body, or null when the input does not validate. A blank reason becomes `defaultReasons` for that date
 * (the caller passes the translated texts).
 */
export function buildAdjustBody(
  input: AdjustInput,
  defaultReasons: Record<AdjustReasonKind, string>,
  now: Date = new Date(),
): AdjustBody | null {
  if (!validateAdjust(input, now).ok || input.targetCents === null) return null;
  return {
    newBalance: input.targetCents / 100,
    date: input.date,
    reason: input.reason.trim() || defaultReasons[adjustReasonKind(input.date, now)],
  };
}

/**
 * Whether the server dated the entry as asked. A backend that predates the `date` field ignores it and dates the entry
 * "now", which the user would not notice otherwise. The instant the server returns is compared with local midnight of
 * the requested day with a 24h window: that absorbs the server and browser time zones differing, while an entry dated
 * "now" for any earlier day falls outside it. An answer without a date cannot be checked and is taken as honored.
 */
export function adjustmentDateHonored(requestedIso: string, returnedDate: string | undefined): boolean {
  if (!returnedDate || !isValidIsoDate(requestedIso)) return true;
  const returned = new Date(returnedDate).getTime();
  if (Number.isNaN(returned)) return true;
  const [y, m, d] = requestedIso.split('-').map(Number) as [number, number, number];
  return Math.abs(returned - new Date(y, m - 1, d).getTime()) < 24 * 60 * 60 * 1000;
}
