import { addMonths } from 'date-fns';

/**
 * Closing day of a credit card statement (mirror of the backend rule in accounts/closing-day.ts).
 *
 * A card normally closes 7 days BEFORE its due day (due day 9 -> closing day 2), counted from the DUE day, and the
 * closing day is also the best day to buy. So the form asks for the due day and suggests the closing day from it.
 */
const DAYS_BETWEEN_CLOSING_AND_DUE = 7;

const WRAP_DAYS = 30;

const isDay = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 31;

/** Closing day suggested for a due day: due - 7, plus 30 when that is <= 0 (9 -> 2, 3 -> 26, 7 -> 30). */
export function closingDayFromDue(dueDay: number | null | undefined): number | null {
  if (!isDay(dueDay)) return null;
  const closing = dueDay - DAYS_BETWEEN_CLOSING_AND_DUE;
  return closing <= 0 ? closing + WRAP_DAYS : closing;
}

/** Effective closing day: the explicit one when set, else derived from the due day, else null (calendar month). */
export function effectiveClosingDay(
  account: { closingDay?: number | null; dueDay?: number | null } | null | undefined,
): number | null {
  if (!account) return null;
  if (isDay(account.closingDay)) return account.closingDay;
  return closingDayFromDue(account.dueDay);
}

export interface ClosingAutoFillInput {
  /** The due day as typed (NaN/undefined/null when empty or invalid). */
  dueDay: number | null | undefined;
  /** The closing day currently in the form (NaN/undefined/null when empty). */
  closingDay: number | null | undefined;
  /** The value this rule suggested last time, or null if it never did. */
  lastSuggested: number | null;
}

export interface ClosingAutoFillResult {
  /** What the closing field should hold after the change (undefined = empty). */
  closingDay: number | undefined;
  /** The suggestion for the new due day, to remember for the next change and to use as placeholder. */
  suggested: number | null;
}

/**
 * The user typed a due day: fill the closing day with due - 7 when the field is empty or still holds the previous
 * suggestion; a value the user typed (anything else) is kept.
 */
export function autoFillClosingDay({ dueDay, closingDay, lastSuggested }: ClosingAutoFillInput): ClosingAutoFillResult {
  const suggested = closingDayFromDue(dueDay);
  const current = isDay(closingDay) ? closingDay : undefined;
  const followsSuggestion = current === undefined || (lastSuggested !== null && current === lastSuggested);
  if (!followsSuggestion) return { closingDay: current, suggested };
  return { closingDay: suggested ?? undefined, suggested };
}

/**
 * Date the installments of a card purchase count from. A purchase on or after the card's effective closing day lands
 * in the NEXT invoice, so the first installment moves one month forward; otherwise two installments would fall in the
 * same invoice month. A card with neither closing nor due day keeps the purchase date.
 */
export function firstInstallmentAnchor(
  purchaseDate: Date,
  card: { closingDay?: number | null; dueDay?: number | null } | null | undefined,
): Date {
  const closing = effectiveClosingDay(card);
  return closing !== null && purchaseDate.getDate() >= closing ? addMonths(purchaseDate, 1) : purchaseDate;
}
