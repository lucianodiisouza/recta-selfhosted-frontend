/**
 * Helpers for editing a credit card's "available limit today" (fdbk #108).
 *
 * The backend stores the difference between its computed available limit and the
 * value the person types as `limitAdjustment` (an adjustment of the used amount),
 * so the client only sends `availableLimit` when the person actually changed it.
 */

const toCents = (value: number): number => Math.round(value * 100);

/**
 * Effective limit the available amount is checked against: the limit typed in the
 * form plus whatever the backend adds on top of the base limit (allocated balance).
 */
export function effectiveCardLimit(
  formCreditLimit: number | undefined,
  account: { creditLimit?: number; totalLimit?: number } | null | undefined,
): number {
  const base = formCreditLimit ?? account?.creditLimit ?? 0;
  const extra =
    account?.totalLimit !== undefined && account?.creditLimit !== undefined
      ? Math.max(0, account.totalLimit - account.creditLimit)
      : 0;
  return base + extra;
}

/** True when the typed available limit differs from the original (cent precision). */
export function availableLimitChanged(
  typed: number | undefined,
  original: number | undefined,
): boolean {
  if (typed === undefined || Number.isNaN(typed)) return false;
  return toCents(typed) !== toCents(original ?? 0);
}

export type AvailableLimitError = 'negative' | 'aboveLimit' | null;

/** Validates the typed available limit: between 0 and the effective limit. */
export function validateAvailableLimit(
  typed: number | undefined,
  limit: number,
): AvailableLimitError {
  if (typed === undefined || Number.isNaN(typed)) return null;
  if (typed < 0) return 'negative';
  if (toCents(typed) > toCents(limit)) return 'aboveLimit';
  return null;
}

/** Normalizes `limitAdjustment` from the API (missing = 0; number or decimal string). */
export function parseLimitAdjustment(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : 0;
}
