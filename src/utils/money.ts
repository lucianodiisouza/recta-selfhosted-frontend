/**
 * Money in integer cents. Amounts travel as reais on the wire (two decimals); parsing and summing happen in cents so
 * 0.1 + 0.2 stays 30. No React and no I/O, so it is testable on its own.
 */

const MAX_INT_DIGITS = 9;

/** Reais (2 decimals, as the server sends them) to integer cents. */
export function reaisToCents(value: number): number {
  // The tiny nudge keeps 1.005-style products from rounding the wrong way.
  return Number.isFinite(value) ? Math.round(value * 100 + (value < 0 ? -1e-6 : 1e-6)) : 0;
}

/** Integer cents to the number sent on the wire (exact: the division is correctly rounded). */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/**
 * What the user typed in a money field, in cents. Accepts "12", "12,5", "12.50", "1.234,56", "R$ 1.234,56" and a
 * dot-thousands integer ("1.234" is 1234). Null when empty or not an amount (negative, letters, 3 decimals).
 */
export function parseMoneyToCents(text: string): number | null {
  let value = text.replace(/R\$/gi, '').replace(/\s+/g, '');
  if (!value) return null;
  if (value.includes(',')) {
    if (value.indexOf(',') !== value.lastIndexOf(',')) return null;
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, '');
  }
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match || match[1].length > MAX_INT_DIGITS) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
}

/** Cents as a money field value ("12,50"), without a thousands separator so it stays easy to edit. */
export function formatCentsInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}
