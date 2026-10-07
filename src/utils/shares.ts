/**
 * Pure logic of the "Divide" dialog (splitting a transaction with people): money and number parsing in integer cents,
 * the split strategies mirrored for the live preview, draft handling and the bodies sent to the server. No React, no
 * axios, no `import.meta`, and no text for the screen: problems are codes the components turn into translated text.
 *
 * Every amount here is an integer number of cents; reais (the wire format) appear only at the edges.
 */
import { reaisToCents } from './people';
import type { PutSharesInput, ShareDirection, SharesPreviewResponse, SplitStrategy, TransactionShare } from '../hooks/api/usePeople';

const MAX_INT_DIGITS = 9;

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
  if (!match || match[1]!.length > MAX_INT_DIGITS) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
}

/** Cents as a money field value ("12,50"), without the thousands separator so it stays easy to edit. */
export function formatCentsInput(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.trunc(cents));
  return `${sign}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** Percent typed by the user, as hundredths of a percent (0.01 to 100.00 -> 1 to 10000); null when invalid. */
export function parsePercentToHundredths(text: string): number | null {
  const value = text.replace(/%/g, '').replace(/\s+/g, '').replace(',', '.');
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const hundredths = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  return hundredths >= 1 && hundredths <= 10000 ? hundredths : null;
}

/** Hundredths of a percent as a field value ("33,33"; "50" when whole). */
export function formatHundredthsInput(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const frac = hundredths % 100;
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, '0').replace(/0$/, '')}`;
}

/** Limits of the server schema (people.schema.ts / split-strategies.ts), mirrored to the letter. */
export const MAX_SHARES = 1000;
export const MAX_SPLIT_ENTRIES = 50;
export const MAX_NOTE = 500;

/** Shares of a person: whole numbers from 1 to 1000. */
export function parseSharesText(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= MAX_SHARES ? n : null;
}

/** My own shares: whole numbers from 0 (the people pay it all) to 1000. */
export function parseMySharesText(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,4}$/.test(value)) return null;
  const n = Number(value);
  return n <= MAX_SHARES ? n : null;
}

// ---- Drafts and the live preview -------------------------------------------------------------------------------

/** What is wrong with one row of the division. */
export type RowError = 'no-person' | 'duplicate' | 'amount' | 'percent' | 'shares' | 'zero-part';

/** What is wrong with the division as a whole. */
export type FormError =
  | { code: 'my-shares' }
  | { code: 'percent-over' }
  | { code: 'too-many'; max: number }
  | { code: 'no-total' }
  | { code: 'sum-over'; sumCents: number; totalCents: number };

export interface ShareDraftRow {
  /** Stable React key; never sent. */
  key: string;
  personId: string;
  amountText: string;
  percentText: string;
  sharesText: string;
  note: string;
}

export interface ShareDraft {
  direction: ShareDirection;
  strategy: SplitStrategy;
  /** Shares of my own part (strategy shares). */
  myShares: string;
  rows: ShareDraftRow[];
}

export function emptyRow(key: string): ShareDraftRow {
  return { key, personId: '', amountText: '', percentText: '', sharesText: '1', note: '' };
}

export function emptyDraft(direction: ShareDirection = 'THEY_OWE_ME', strategy: SplitStrategy = 'equal'): ShareDraft {
  return { direction, strategy, myShares: '1', rows: [emptyRow('r1')] };
}

/** The stored shares of one direction as an editable draft (exact values, one row per share). */
export function draftFromShares(shares: readonly TransactionShare[], direction: ShareDirection): ShareDraft {
  const own = shares.filter((s) => s.direction === direction);
  if (own.length === 0) return emptyDraft(direction, 'equal');
  return {
    direction,
    strategy: 'exact',
    myShares: '1',
    rows: own.map((s, index) => ({
      key: `s${index + 1}`,
      personId: s.personId,
      amountText: formatCentsInput(reaisToCents(s.amount)),
      percentText: '',
      sharesText: '1',
      note: s.note ?? '',
    })),
  };
}

/** The direction the dialog opens on: THEY_OWE_ME unless the only stored shares are I_OWE_THEM. */
export function initialDirection(shares: readonly TransactionShare[]): ShareDirection {
  const hasMine = shares.some((s) => s.direction === 'THEY_OWE_ME');
  const hasTheirs = shares.some((s) => s.direction === 'I_OWE_THEM');
  return !hasMine && hasTheirs ? 'I_OWE_THEM' : 'THEY_OWE_ME';
}

export interface SharePartPreview {
  key: string;
  personId: string;
  /** Null while the row is incomplete or invalid. */
  cents: number | null;
  error: RowError | null;
}

export interface SharePreview {
  parts: SharePartPreview[];
  totalCents: number;
  /** Sum of the parts of the people. */
  sumCents: number;
  /** The total minus the parts: "my part" when they owe me. */
  restCents: number;
  /** No row at all: saving it clears the direction. */
  isEmpty: boolean;
  /** Every row is fine and the parts fit in the total. */
  valid: boolean;
  formError: FormError | null;
}

/** Part of `total` for `numerator / denominator`, rounded down, in exact integer arithmetic. */
function floorShare(total: number, numerator: number, denominator: number): number {
  return Math.floor((total * numerator) / denominator);
}

/**
 * The parts of each person, by strategy, in cents. Rows are valid when complete; the caller checks that. The
 * remainder cents go to the FIRST person of the list (the server rule): the others and I keep the rounded-down
 * part. `exact` parts are the typed amounts.
 */
export function splitCents(
  totalCents: number,
  strategy: SplitStrategy,
  rows: ReadonlyArray<{ amount?: number; hundredths?: number; shares?: number }>,
  myShares = 1,
): number[] {
  const n = rows.length;
  if (n === 0) return [];
  if (strategy === 'exact') return rows.map((r) => r.amount ?? 0);
  if (strategy === 'equal') {
    const base = Math.floor(totalCents / (n + 1));
    const remainder = totalCents - base * (n + 1);
    return rows.map((_, index) => base + (index === 0 ? remainder : 0));
  }
  if (strategy === 'shares') {
    const denominator = myShares + rows.reduce((sum, r) => sum + (r.shares ?? 0), 0);
    const parts = rows.map((r) => floorShare(totalCents, r.shares ?? 0, denominator));
    const mine = floorShare(totalCents, myShares, denominator);
    parts[0]! += totalCents - mine - parts.reduce((sum, p) => sum + p, 0);
    return parts;
  }
  // percent: of the total; the remainder only exists when the percentages cover the whole transaction
  const parts = rows.map((r) => floorShare(totalCents, r.hundredths ?? 0, 10000));
  const covered = rows.reduce((sum, r) => sum + (r.hundredths ?? 0), 0) === 10000;
  if (covered) parts[0]! += totalCents - parts.reduce((sum, p) => sum + p, 0);
  return parts;
}

/** The live preview of a draft: per-row errors, the parts, the sum and what is left for me. */
export function computeSharePreview(totalCents: number, draft: ShareDraft): SharePreview {
  const rows = draft.rows;
  const errors = new Map<string, RowError>();
  const seen = new Set<string>();
  const parsed = rows.map((row) => {
    let error: RowError | null = null;
    if (!row.personId) error = 'no-person';
    else if (seen.has(row.personId)) error = 'duplicate';
    seen.add(row.personId);
    let amount: number | undefined;
    let hundredths: number | undefined;
    let shares: number | undefined;
    if (draft.strategy === 'exact') {
      const cents = parseMoneyToCents(row.amountText);
      if (cents === null || cents <= 0) error = error ?? 'amount';
      else amount = cents;
    } else if (draft.strategy === 'percent') {
      const value = parsePercentToHundredths(row.percentText);
      if (value === null) error = error ?? 'percent';
      else hundredths = value;
    } else if (draft.strategy === 'shares') {
      const value = parseSharesText(row.sharesText);
      if (value === null) error = error ?? 'shares';
      else shares = value;
    }
    if (error) errors.set(row.key, error);
    return { amount, hundredths, shares };
  });

  let formError: FormError | null = null;
  const myShares = parseMySharesText(draft.myShares);
  if (draft.strategy === 'shares' && myShares === null) formError = { code: 'my-shares' };
  if (draft.strategy === 'percent' && errors.size === 0) {
    const total = parsed.reduce((sum, r) => sum + (r.hundredths ?? 0), 0);
    if (total > 10000) formError = { code: 'percent-over' };
  }
  if (rows.length > MAX_SPLIT_ENTRIES) formError = formError ?? { code: 'too-many', max: MAX_SPLIT_ENTRIES };
  if (rows.length > 0 && totalCents <= 0) formError = formError ?? { code: 'no-total' };

  const computable = errors.size === 0 && formError === null && rows.length > 0;
  const cents = computable ? splitCents(totalCents, draft.strategy, parsed, myShares ?? 1) : null;
  if (cents) {
    rows.forEach((row, index) => {
      if (cents[index]! <= 0) errors.set(row.key, 'zero-part');
    });
  }
  const sumCents = cents ? cents.reduce((sum, c) => sum + c, 0) : 0;
  if (cents && errors.size === 0 && sumCents > totalCents) {
    formError = { code: 'sum-over', sumCents, totalCents };
  }

  return {
    parts: rows.map((row, index) => ({
      key: row.key,
      personId: row.personId,
      cents: cents && !errors.has(row.key) ? cents[index]! : null,
      error: errors.get(row.key) ?? null,
    })),
    totalCents,
    sumCents,
    restCents: totalCents - sumCents,
    isEmpty: rows.length === 0,
    valid: errors.size === 0 && formError === null,
    formError,
  };
}

/**
 * Switching the strategy keeps what the user already has: the computed parts become the exact amounts of `exact`, or
 * the percentages of `percent` ONLY when a percentage reproduces the part to the cent (a percentage with two decimals
 * cannot say 5.00 of 10.01, and a wrong one would silently change the division). Otherwise that field is left blank
 * for the user to fill, and an invalid draft only changes strategy.
 */
export function convertDraftStrategy(draft: ShareDraft, strategy: SplitStrategy, totalCents: number): ShareDraft {
  if (draft.strategy === strategy) return draft;
  const preview = computeSharePreview(totalCents, draft);
  const usable = preview.valid && !preview.isEmpty && totalCents > 0;
  const before = preview.parts.map((p) => p.cents);
  const rows = draft.rows.map((row, index) => {
    const part = usable ? before[index]! : null;
    if (part === null) return row;
    if (strategy === 'exact') return { ...row, amountText: formatCentsInput(part) };
    if (strategy === 'percent') {
      const hundredths = Math.round((part * 10000) / totalCents);
      const exact = hundredths >= 1 && hundredths <= 10000 && floorShare(totalCents, hundredths, 10000) === part;
      return { ...row, percentText: exact ? formatHundredthsInput(hundredths) : '' };
    }
    return row;
  });
  let next: ShareDraft = { ...draft, strategy, rows };
  if (usable && strategy === 'percent') {
    // The rows may each be exact and still not add up (the whole-transaction remainder rule): then none is trusted.
    const after = computeSharePreview(totalCents, next);
    if (!after.valid || after.parts.some((p, index) => p.cents !== before[index])) {
      next = { ...next, rows: rows.map((row) => ({ ...row, percentText: '' })) };
    }
  }
  return next;
}

/** The PUT body of a valid draft; null when the draft is invalid or empty (an empty one clears: see clearSharesInput). */
export function buildPutSharesInput(totalCents: number, draft: ShareDraft): PutSharesInput | null {
  const preview = computeSharePreview(totalCents, draft);
  if (!preview.valid || preview.isEmpty) return null;
  const entries = draft.rows.map((row) => {
    const entry: PutSharesInput['entries'][number] = { personId: row.personId };
    if (draft.strategy === 'exact') entry.amount = centsToReais(parseMoneyToCents(row.amountText) ?? 0);
    if (draft.strategy === 'percent') entry.percent = (parsePercentToHundredths(row.percentText) ?? 0) / 100;
    if (draft.strategy === 'shares') entry.shares = parseSharesText(row.sharesText) ?? 0;
    const note = row.note.trim();
    if (note) entry.note = note;
    return entry;
  });
  const input: PutSharesInput = { direction: draft.direction, strategy: draft.strategy, entries };
  if (draft.strategy === 'shares') input.myShares = parseMySharesText(draft.myShares) ?? 1;
  return input;
}

/** Removes every share of one direction. */
export function clearSharesInput(direction: ShareDirection): PutSharesInput {
  return { direction, strategy: 'exact', entries: [] };
}

export interface SharesDifference {
  personId: string;
  localCents: number | null;
  serverCents: number | null;
}

/** What differs between the local preview and the server one (empty = the same division). */
export function compareWithServer(preview: SharePreview, server: SharesPreviewResponse): { differences: SharesDifference[]; restDiffers: boolean } {
  const local = new Map(preview.parts.map((p) => [p.personId, p.cents]));
  const remote = new Map(server.shares.map((s) => [s.personId, reaisToCents(s.amount)]));
  const differences: SharesDifference[] = [];
  for (const personId of new Set([...local.keys(), ...remote.keys()])) {
    const l = local.get(personId) ?? null;
    const r = remote.get(personId) ?? null;
    if (l !== r) differences.push({ personId, localCents: l, serverCents: r });
  }
  return { differences, restDiffers: reaisToCents(server.myPart) !== preview.restCents };
}

/** Adopts the amounts the server computed as exact values (when its rule differs from the local preview). */
export function draftFromServerPreview(draft: ShareDraft, server: SharesPreviewResponse): ShareDraft {
  const amounts = new Map(server.shares.map((s) => [s.personId, reaisToCents(s.amount)]));
  return {
    ...draft,
    strategy: 'exact',
    rows: draft.rows.map((row) => {
      const cents = amounts.get(row.personId);
      return cents === undefined ? row : { ...row, amountText: formatCentsInput(cents) };
    }),
  };
}
