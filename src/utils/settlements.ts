/**
 * Pure logic of the settlement dialog (money that changed hands with a person): the suggested direction and amount,
 * validation, the body sent to the server and the account remembered per household. No React and no text for the
 * screen: problems are codes the dialog turns into translated text.
 */
import { centsToReais, formatCentsInput, parseMoneyToCents } from './shares';
import { reaisToCents } from './people';
import type { CreateSettlementInput, SettlementDirection } from '../hooks/api/usePeople';

/** Direction and amount that zero the balance: they owe me (or nothing) -> RECEIVED; I owe them -> PAID. */
export function suggestSettlement(balance: number): { direction: SettlementDirection; amountCents: number } {
  const cents = reaisToCents(balance);
  return cents < 0 ? { direction: 'PAID', amountCents: -cents } : { direction: 'RECEIVED', amountCents: cents };
}

/** The balance (cents; > 0 they owe me) after a settlement: RECEIVED lowers it, PAID raises it. */
export function balanceAfterSettlement(balanceCents: number, direction: SettlementDirection, amountCents: number): number {
  return direction === 'RECEIVED' ? balanceCents - amountCents : balanceCents + amountCents;
}

export type SettlementMode = 'create' | 'link' | 'none';

export interface SettlementDraft {
  direction: SettlementDirection;
  amountText: string;
  /** YYYY-MM-DD */
  date: string;
  note: string;
  mode: SettlementMode;
  accountId: string;
  description: string;
  transactionId: string;
}

/** The dialog opens with the balance as the suggestion; `description` is filled by the dialog (it is translated text). */
export function defaultSettlementDraft(balance: number, today: string): SettlementDraft {
  const { direction, amountCents } = suggestSettlement(balance);
  return {
    direction,
    amountText: amountCents > 0 ? formatCentsInput(amountCents) : '',
    date: today,
    note: '',
    mode: 'create',
    accountId: '',
    description: '',
    transactionId: '',
  };
}

export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export interface SettlementValidation {
  ok: boolean;
  amountCents: number | null;
  /** The fields that are wrong; the dialog turns each one into text. */
  errors: { amount?: true; date?: true; account?: true; transaction?: true };
}

export function validateSettlement(draft: SettlementDraft): SettlementValidation {
  const errors: SettlementValidation['errors'] = {};
  const amountCents = parseMoneyToCents(draft.amountText);
  if (amountCents === null || amountCents <= 0) errors.amount = true;
  if (!isValidIsoDate(draft.date)) errors.date = true;
  if (draft.mode === 'create' && !draft.accountId) errors.account = true;
  if (draft.mode === 'link' && !draft.transactionId) errors.transaction = true;
  return { ok: Object.keys(errors).length === 0, amountCents: amountCents !== null && amountCents > 0 ? amountCents : null, errors };
}

/** The POST body; only the fields of the chosen mode are sent. Null when the draft is invalid. */
export function buildSettlementInput(draft: SettlementDraft, householdId: string): CreateSettlementInput | null {
  const check = validateSettlement(draft);
  if (!check.ok || check.amountCents === null) return null;
  const input: CreateSettlementInput = {
    householdId,
    direction: draft.direction,
    amount: centsToReais(check.amountCents),
    date: draft.date,
  };
  const note = draft.note.trim();
  if (note) input.note = note;
  if (draft.mode === 'link') input.transactionId = draft.transactionId;
  if (draft.mode === 'create') {
    const description = draft.description.trim();
    input.createTransaction = description ? { accountId: draft.accountId, description } : { accountId: draft.accountId };
  }
  return input;
}

// ---- Remembered account (per household) -----------------------------------------------------------------------

/** The account last used for a settlement in this household; '' when unknown or the stored value is corrupt. */
export function parseSavedSettlementAccount(raw: string | null, householdId: string): string {
  if (!raw) return '';
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return '';
    const value = (parsed as Record<string, unknown>)[householdId];
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}

/** Storage value with the account of `householdId` set; the other households are kept (a corrupt value is replaced). */
export function mergeSavedSettlementAccount(raw: string | null, householdId: string, accountId: string): string {
  let current: Record<string, unknown> = {};
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) current = parsed as Record<string, unknown>;
  } catch {
    current = {};
  }
  return JSON.stringify({ ...current, [householdId]: accountId });
}

/** Accounts a settlement transaction can be created on: active and not a credit card. */
export function settlementAccounts<T extends { type?: string; isActive?: boolean }>(accounts: readonly T[]): T[] {
  return accounts.filter((a) => a.type !== 'CREDIT' && a.isActive !== false);
}
