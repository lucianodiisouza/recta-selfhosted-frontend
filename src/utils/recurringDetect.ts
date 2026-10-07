/**
 * Pure logic of "Detect recurring": the default selection, the groups (stable value / monthly bill), the bulk toggles,
 * the adjustments of a candidate (amount, day of the month, description, follow the last amount) with their validation,
 * the apply payload and the numbers shown next to it (one source for both) and the blocker. No React, no axios and no
 * text: validation and blockers are codes the dialog translates.
 *
 * The server owns the candidates and recomputes them on apply. The client only chooses among them (items, by id) and
 * adjusts what the user wants different. Amounts are integer cents here; reais only on the wire.
 */
import { centsToReais, formatCentsInput, parseMoneyToCents, reaisToCents } from './money';
import type {
  RecurringApplyInput, RecurringApplyItem, RecurringCandidate, RecurringCandidateKind,
} from '../hooks/api/useDetectRecurring';

export const MAX_DESCRIPTION = 500;

// ---- Draft: what the user chose and typed ---------------------------------------------------------------------------

/** What the user typed in one candidate; a missing field means "as suggested". */
export interface CandidateEdit {
  amountText?: string;
  dayText?: string;
  description?: string;
  followLast?: boolean;
}

export interface DetectDraft {
  /** By candidate id. */
  selected: Record<string, boolean>;
  edits: Record<string, CandidateEdit>;
}

/** The server default for a candidate that does not say: the recurrence follows the last amount. */
export function candidateFollowsLast(candidate: Pick<RecurringCandidate, 'followLastAmount'>): boolean {
  return candidate.followLastAmount !== false;
}

/** The server marks (`defaultSelected`) are the default selection; the edits start empty. */
export function defaultDraft(candidates: readonly RecurringCandidate[]): DetectDraft {
  const selected: Record<string, boolean> = {};
  for (const c of candidates) selected[c.id] = c.defaultSelected === true;
  return { selected, edits: {} };
}

/**
 * Draft after a new detection: a candidate that was already there keeps its selection and edits; a new one gets the
 * defaults; one that is gone leaves no trace.
 */
export function reconcileDraft(prev: DetectDraft, prevCandidates: readonly RecurringCandidate[], next: readonly RecurringCandidate[]): DetectDraft {
  const before = new Set(prevCandidates.map((c) => c.id));
  const fresh = defaultDraft(next);
  const selected: Record<string, boolean> = {};
  const edits: Record<string, CandidateEdit> = {};
  for (const c of next) {
    const known = before.has(c.id);
    selected[c.id] = known && c.id in prev.selected ? prev.selected[c.id] : fresh.selected[c.id];
    if (known && prev.edits[c.id]) edits[c.id] = prev.edits[c.id];
  }
  return { selected, edits };
}

export interface CandidateGroup {
  kind: RecurringCandidateKind;
  candidates: RecurringCandidate[];
}

const isBill = (c: Pick<RecurringCandidate, 'kind'>): boolean => c.kind === 'bill';

/** Stable values first, then the monthly bills; empty groups are dropped; the server order is kept inside each. A kind this client does not know goes with the stable ones. */
export function groupCandidates(candidates: readonly RecurringCandidate[]): CandidateGroup[] {
  const groups: CandidateGroup[] = [
    { kind: 'stable', candidates: candidates.filter((c) => !isBill(c)) },
    { kind: 'bill', candidates: candidates.filter(isBill) },
  ];
  return groups.filter((g) => g.candidates.length > 0);
}

export function setSelected(draft: DetectDraft, id: string, selected: boolean): DetectDraft {
  return { ...draft, selected: { ...draft.selected, [id]: selected } };
}

/** Every candidate of the kind, ticked or unticked (the other kind is untouched). */
export function setKindSelected(draft: DetectDraft, candidates: readonly RecurringCandidate[], kind: RecurringCandidateKind, selected: boolean): DetectDraft {
  const next = { ...draft.selected };
  for (const c of candidates) if ((kind === 'bill') === isBill(c)) next[c.id] = selected;
  return { ...draft, selected: next };
}

/** True when every candidate of the kind is ticked (and there is at least one): the link then offers to untick. */
export function kindFullySelected(draft: DetectDraft, candidates: readonly RecurringCandidate[], kind: RecurringCandidateKind): boolean {
  const of = candidates.filter((c) => (kind === 'bill') === isBill(c));
  return of.length > 0 && of.every((c) => draft.selected[c.id] === true);
}

function patchEdit(draft: DetectDraft, id: string, patch: CandidateEdit): DetectDraft {
  return { ...draft, edits: { ...draft.edits, [id]: { ...draft.edits[id], ...patch } } };
}

export const setAmountText = (draft: DetectDraft, id: string, amountText: string): DetectDraft => patchEdit(draft, id, { amountText });
export const setDayText = (draft: DetectDraft, id: string, dayText: string): DetectDraft => patchEdit(draft, id, { dayText });
export const setDescriptionText = (draft: DetectDraft, id: string, description: string): DetectDraft => patchEdit(draft, id, { description });
export const setFollowLast = (draft: DetectDraft, id: string, followLast: boolean): DetectDraft => patchEdit(draft, id, { followLast });

/** "Follow the last value" for every candidate at once. */
export function setAllFollowLast(draft: DetectDraft, candidates: readonly RecurringCandidate[], followLast: boolean): DetectDraft {
  const edits = { ...draft.edits };
  for (const c of candidates) edits[c.id] = { ...edits[c.id], followLast };
  return { ...draft, edits };
}

/** True when every candidate currently follows the last amount (the bulk toggle then offers to turn it off). */
export function allFollowLast(draft: DetectDraft, candidates: readonly RecurringCandidate[]): boolean {
  return candidates.length > 0 && candidates.every((c) => (draft.edits[c.id]?.followLast ?? candidateFollowsLast(c)) === true);
}

// ---- A candidate with its adjustments --------------------------------------------------------------------------------

export type AmountError = 'empty' | 'invalid' | 'zero';
export type DescriptionError = 'empty' | 'long';

export interface ResolvedCandidate {
  candidate: RecurringCandidate;
  selected: boolean;
  /** The text of each field as shown (typed, or the suggestion). */
  amountText: string;
  dayText: string;
  description: string;
  followLast: boolean;
  /** Integer cents of the amount that will be used (null when the typed amount is invalid). */
  amountCents: number | null;
  day: number | null;
  errors: { amount?: AmountError; day?: 'invalid'; description?: DescriptionError };
  /** The fields the user changed from the suggestion: only these go in the request. */
  adjusted: { amount: boolean; day: boolean; description: boolean; followLast: boolean };
}

export function resolveCandidate(candidate: RecurringCandidate, draft: DetectDraft): ResolvedCandidate {
  const edit = draft.edits[candidate.id] ?? {};
  const suggestedCents = reaisToCents(candidate.amount);
  const amountText = edit.amountText ?? formatCentsInput(suggestedCents);
  const dayText = edit.dayText ?? String(candidate.dayOfMonth);
  const description = edit.description ?? candidate.description;
  const followLast = edit.followLast ?? candidateFollowsLast(candidate);
  const errors: ResolvedCandidate['errors'] = {};

  let amountCents: number | null = null;
  if (amountText.trim() === '') errors.amount = 'empty';
  else {
    const parsed = parseMoneyToCents(amountText);
    if (parsed === null) errors.amount = 'invalid';
    else if (parsed <= 0) errors.amount = 'zero';
    else amountCents = parsed;
  }

  let day: number | null = null;
  if (/^\d{1,2}$/.test(dayText.trim())) {
    const n = Number(dayText.trim());
    if (n >= 1 && n <= 31) day = n;
  }
  if (day === null) errors.day = 'invalid';

  const trimmed = description.trim();
  if (!trimmed) errors.description = 'empty';
  else if (trimmed.length > MAX_DESCRIPTION) errors.description = 'long';

  return {
    candidate,
    selected: draft.selected[candidate.id] === true,
    amountText,
    dayText,
    description,
    followLast,
    amountCents,
    day,
    errors,
    adjusted: {
      amount: amountCents !== null && amountCents !== suggestedCents,
      day: day !== null && day !== candidate.dayOfMonth,
      description: !errors.description && trimmed !== candidate.description,
      followLast: followLast !== candidateFollowsLast(candidate),
    },
  };
}

export function hasErrors(item: Pick<ResolvedCandidate, 'errors'>): boolean {
  return !!(item.errors.amount || item.errors.day || item.errors.description);
}

// ---- Apply payload and totals (one source) -------------------------------------------------------------------------------

export interface DetectTotals {
  /** Candidates ticked. */
  count: number;
  stableCount: number;
  billCount: number;
  /** Of the ticked ones, those that follow the last amount. */
  followCount: number;
  /** Sum of the ticked amounts (integer cents): what the recurrences add up to each month. */
  monthlyCents: number;
  /** Ticked candidates with an invalid adjustment. */
  invalidCount: number;
}

export interface BuiltDetectApply {
  payload: RecurringApplyInput;
  /** The ticked candidates, in the order of the server. */
  items: ResolvedCandidate[];
  totals: DetectTotals;
}

/** Items carry only what the user adjusted: the server recomputes the rest. Unticked candidates are not sent. */
export function buildDetectApply(
  householdId: string,
  candidates: readonly RecurringCandidate[],
  draft: DetectDraft,
  params: { minMonths?: number; months?: number } = {},
): BuiltDetectApply {
  const items = candidates.map((c) => resolveCandidate(c, draft)).filter((r) => r.selected);
  const totals: DetectTotals = { count: items.length, stableCount: 0, billCount: 0, followCount: 0, monthlyCents: 0, invalidCount: 0 };
  const sent: RecurringApplyItem[] = [];
  for (const r of items) {
    if (isBill(r.candidate)) totals.billCount += 1;
    else totals.stableCount += 1;
    if (r.followLast) totals.followCount += 1;
    if (hasErrors(r)) totals.invalidCount += 1;
    totals.monthlyCents += r.amountCents ?? 0;
    const item: RecurringApplyItem = { id: r.candidate.id };
    if (r.adjusted.amount && r.amountCents !== null) item.amount = centsToReais(r.amountCents);
    if (r.adjusted.day && r.day !== null) item.dayOfMonth = r.day;
    if (r.adjusted.description) item.description = r.description.trim();
    if (r.adjusted.followLast) item.followLastAmount = r.followLast;
    sent.push(item);
  }
  const payload: RecurringApplyInput = {
    householdId,
    ...(params.minMonths !== undefined && { minMonths: params.minMonths }),
    ...(params.months !== undefined && { months: params.months }),
    items: sent,
  };
  return { payload, items, totals };
}

export type DetectBlockerCode = 'applying' | 'needs-refresh' | 'none-selected' | 'invalid';

/**
 * Why Apply must stay disabled; null when it can go. `needsRefresh` (an apply failed and nothing was detected since) is
 * required on purpose: a failed apply may have created part of the recurrences, so the list on screen is stale.
 */
export function detectBlocker(built: BuiltDetectApply | null, state: { needsRefresh: boolean; applying: boolean }): DetectBlockerCode | null {
  if (state.applying) return 'applying';
  if (state.needsRefresh) return 'needs-refresh';
  if (!built || built.totals.count === 0) return 'none-selected';
  if (built.totals.invalidCount > 0) return 'invalid';
  return null;
}

/** 0..1 as "85%". */
export function confidenceText(confidence: number): string {
  const n = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  return `${Math.round(n * 100)}%`;
}

/** Whether the amounts varied across the months seen (the range is only worth showing then). */
export function amountVaried(c: Pick<RecurringCandidate, 'minAmount' | 'maxAmount'>): boolean {
  return reaisToCents(c.minAmount) !== reaisToCents(c.maxAmount);
}

/**
 * A 4xx means the server refused before writing; anything else (network, 5xx) may have created part of the
 * recurrences, and the next detection shows them as already recurring.
 */
export function applyRefusedBeforeWriting(status?: number): boolean {
  return status !== undefined && status >= 400 && status < 500;
}
