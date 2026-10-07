/**
 * Pure logic of the people page (shared expenses): balances, the people list, the ledger and the person form. No
 * React, no axios and no `import.meta`. Nothing here returns text for the screen: messages are codes (or a code with
 * the values to fill in) that the components turn into translated strings.
 *
 * Amounts arrive from the API in reais with two decimals and are compared in integer cents.
 */
import type { LedgerEntry, Person, PersonBalance } from '../hooks/api/usePeople';

/** Limits of the server schema (people.schema.ts, people.common.ts), mirrored so the form can say no before a round trip. */
export const MAX_ALIASES = 20;
export const MAX_PERSON_NAME = 100;

/** Reais (2 decimals, as sent by the server) to integer cents. */
export function reaisToCents(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 100 + (value < 0 ? -1e-6 : 1e-6)) : 0;
}

/** Replaces the `{{name}}` placeholders of a translated text. A placeholder without a value is left as written. */
export function fillText(text: string, values: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

/** Lookup key of a name: lower case, no accents, single spaces (the server normalizes the same way). */
export function normalizeName(label: string): string {
  return label.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Whether the household member may change people (the server asks for EDITOR or more). A household that is not known
 * yet counts as no.
 */
export function canWritePeople(household: { role?: string } | null | undefined): boolean {
  return !!household && household.role !== 'VIEWER';
}

/**
 * True for the 404 or 405 of a server that has no people routes: they come from the framework's own router and carry
 * no application error code (a person that does not exist is a `NOT_FOUND`).
 */
export function isPeopleRouteMissing(error: unknown): boolean {
  const { status, code } = (error ?? {}) as { status?: number; code?: string };
  return (status === 404 || status === 405) && code === undefined;
}

// ---- Balances -------------------------------------------------------------------------------------------------

export type BalanceKind = 'owes-me' | 'i-owe' | 'settled';

export interface BalanceStatus {
  kind: BalanceKind;
  /** Absolute value, in cents. */
  cents: number;
}

/** The sign of a balance decides who owes whom; cents decide, not floats. */
export function balanceStatus(balance: number): BalanceStatus {
  const cents = reaisToCents(balance);
  if (cents > 0) return { kind: 'owes-me', cents };
  if (cents < 0) return { kind: 'i-owe', cents: -cents };
  return { kind: 'settled', cents: 0 };
}

export interface BalancesSummary {
  /** Sum of the positive balances. */
  owedToMeCents: number;
  /** Sum of the negative balances, as a positive number. */
  iOweCents: number;
  /** owedToMe - iOwe. */
  netCents: number;
}

export function summarizeBalances(items: ReadonlyArray<Pick<PersonBalance, 'balance'>>): BalancesSummary {
  let owedToMeCents = 0;
  let iOweCents = 0;
  for (const item of items) {
    const cents = reaisToCents(item.balance);
    if (cents > 0) owedToMeCents += cents;
    else iOweCents += -cents;
  }
  return { owedToMeCents, iOweCents, netCents: owedToMeCents - iOweCents };
}

export interface PersonRow {
  person: Person;
  balance: PersonBalance | null;
  balanceCents: number;
}

/**
 * The rows of the people list: every person that has a balance entry, plus (when inactive people are shown) the ones
 * the balances endpoint leaves out. Active people first, then by name; inactive ones last.
 */
export function mergePeopleRows(balances: readonly PersonBalance[], people: readonly Person[], showInactive: boolean): PersonRow[] {
  const rows = new Map<string, PersonRow>();
  for (const b of balances) rows.set(b.person.id, { person: b.person, balance: b, balanceCents: reaisToCents(b.balance) });
  for (const p of people) {
    if (rows.has(p.id)) continue;
    if (!p.isActive && !showInactive) continue;
    rows.set(p.id, { person: p, balance: null, balanceCents: 0 });
  }
  return [...rows.values()]
    .filter((row) => row.person.isActive || showInactive || row.balanceCents !== 0)
    .sort((a, b) => Number(b.person.isActive) - Number(a.person.isActive) || a.person.name.localeCompare(b.person.name));
}

// ---- Ledger ---------------------------------------------------------------------------------------------------

export type LedgerKind = 'their-share' | 'my-share' | 'received' | 'paid';

/** Which line of the statement this is: a share (by direction) or a settlement (by direction). */
export function ledgerKind(entry: Pick<LedgerEntry, 'kind' | 'direction'>): LedgerKind {
  if (entry.kind === 'share') return entry.direction === 'THEY_OWE_ME' ? 'their-share' : 'my-share';
  return entry.direction === 'RECEIVED' ? 'received' : 'paid';
}

// ---- Person form ----------------------------------------------------------------------------------------------

/** Aliases typed as a comma or semicolon separated list. */
export function parseAliasText(text: string): string[] {
  return text.split(/[,;]/).map((a) => a.trim()).filter(Boolean);
}

/** Trimmed, without repeats (normalized like the server) and without the name itself. */
export function cleanAliases(name: string, aliases: readonly string[]): string[] {
  const seen = new Set<string>([normalizeName(name)]);
  const out: string[] = [];
  for (const raw of aliases) {
    const alias = raw.trim();
    const key = normalizeName(alias);
    if (!alias || seen.has(key)) continue;
    seen.add(key);
    out.push(alias);
  }
  return out;
}

export type PersonFormError =
  | { code: 'name-required' }
  | { code: 'name-too-long'; max: number }
  | { code: 'too-many-aliases'; max: number }
  | { code: 'alias-too-long'; max: number }
  | { code: 'name-taken'; label: string; owner: string };

export interface PersonFormValidation {
  ok: boolean;
  error?: PersonFormError;
}

/**
 * The name must be filled, and neither the name nor an alias may be the name or alias of ANOTHER person (the server
 * answers 409; saying it here saves a round trip). `others` are the people already registered.
 */
export function validatePersonForm(
  name: string,
  aliases: readonly string[],
  others: ReadonlyArray<Pick<Person, 'id' | 'name' | 'aliases'>>,
  editingId: string | null,
): PersonFormValidation {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: { code: 'name-required' } };
  if (trimmed.length > MAX_PERSON_NAME) return { ok: false, error: { code: 'name-too-long', max: MAX_PERSON_NAME } };
  const cleaned = cleanAliases(trimmed, aliases);
  if (cleaned.length > MAX_ALIASES) return { ok: false, error: { code: 'too-many-aliases', max: MAX_ALIASES } };
  if (cleaned.some((a) => a.length > MAX_PERSON_NAME)) return { ok: false, error: { code: 'alias-too-long', max: MAX_PERSON_NAME } };
  const mine = [trimmed, ...cleaned];
  for (const other of others) {
    if (other.id === editingId) continue;
    const taken = new Set([normalizeName(other.name), ...other.aliases.map(normalizeName)]);
    const clash = mine.find((m) => taken.has(normalizeName(m)));
    if (clash) return { ok: false, error: { code: 'name-taken', label: clash, owner: other.name } };
  }
  return { ok: true };
}

/** What a failed save means: the server's 409 says the name or alias is taken. */
export function personSaveFailure(error: unknown): { code: 'conflict' } | { code: 'message'; message: string } | { code: 'unknown' } {
  const status = (error as { status?: number } | null)?.status;
  if (status === 409) return { code: 'conflict' };
  if (error instanceof Error && error.message) return { code: 'message', message: error.message };
  return { code: 'unknown' };
}
