import { describe, expect, it } from 'vitest';
import type { RecurringCandidate } from '../hooks/api/useDetectRecurring';
import {
  allFollowLast, amountVaried, applyRefusedBeforeWriting, buildDetectApply, candidateFollowsLast, confidenceText, defaultDraft, detectBlocker,
  groupCandidates, kindFullySelected, reconcileDraft, resolveCandidate, setAllFollowLast, setAmountText, setDayText, setDescriptionText,
  setFollowLast, setKindSelected, setSelected,
} from './recurringDetect';

// Invented data only.
const cand = (id: string, description: string, o: Partial<RecurringCandidate> = {}): RecurringCandidate => ({
  id, accountId: 'acc-main', accountName: 'Main account', description, categoryName: 'UTILITIES', amount: 100, medianAmount: 100, minAmount: 100, maxAmount: 100,
  dayOfMonth: 10, monthsSeen: 6, windowMonths: 12, lastMonth: '2026-09', kind: 'stable', confidence: 0.9, defaultSelected: true, followLastAmount: true,
  examples: [{ transactionId: 't1', date: '2026-09-10', amount: 100, description }], ...o,
});

const STREAM = cand('c-stream', 'Streaming Alfa', { amount: 39.9, minAmount: 39.9, maxAmount: 39.9, dayOfMonth: 5 });
const GYM = cand('c-gym', 'Gym Beta', { amount: 120, dayOfMonth: 12, defaultSelected: false });
const POWER = cand('c-power', 'Power bill', { kind: 'bill', amount: 187.43, minAmount: 150.1, maxAmount: 210, medianAmount: 180, dayOfMonth: 20, confidence: 0.7 });
const WATER = cand('c-water', 'Water bill', { kind: 'bill', amount: 64.5, dayOfMonth: 15, defaultSelected: false });
const ALL = [STREAM, GYM, POWER, WATER];
const IDLE = { needsRefresh: false, applying: false };

describe('selection', () => {
  it('uses the server marks as the default selection, with no edits', () => {
    const d = defaultDraft(ALL);
    expect(d.selected).toEqual({ 'c-stream': true, 'c-gym': false, 'c-power': true, 'c-water': false });
    expect(d.edits).toEqual({});
  });

  it('groups stable first, then bills, keeping the server order and dropping empty groups', () => {
    const groups = groupCandidates([POWER, STREAM, WATER, GYM]);
    expect(groups.map((g) => [g.kind, g.candidates.map((c) => c.id)])).toEqual([['stable', ['c-stream', 'c-gym']], ['bill', ['c-power', 'c-water']]]);
    expect(groupCandidates([POWER]).map((g) => g.kind)).toEqual(['bill']);
    expect(groupCandidates([])).toEqual([]);
    expect(groupCandidates([cand('x', 'New kind', { kind: 'weird' as never })])[0].kind).toBe('stable');
  });

  it('selects a whole kind without touching the other', () => {
    const d0 = defaultDraft(ALL);
    const stable = setKindSelected(d0, ALL, 'stable', true);
    expect(stable.selected).toEqual({ 'c-stream': true, 'c-gym': true, 'c-power': true, 'c-water': false });
    const bills = setKindSelected(d0, ALL, 'bill', true);
    expect(bills.selected).toEqual({ 'c-stream': true, 'c-gym': false, 'c-power': true, 'c-water': true });
    expect(setKindSelected(bills, ALL, 'bill', false).selected).toEqual({ 'c-stream': true, 'c-gym': false, 'c-power': false, 'c-water': false });
    expect(kindFullySelected(stable, ALL, 'stable')).toBe(true);
    expect(kindFullySelected(stable, ALL, 'bill')).toBe(false);
    expect(kindFullySelected(d0, [], 'bill')).toBe(false);
  });

  it('ticks a single candidate', () => {
    expect(setSelected(defaultDraft(ALL), 'c-gym', true).selected['c-gym']).toBe(true);
  });

  it('keeps what the user did across a new detection, defaults new ones and drops the gone ones', () => {
    let d = defaultDraft(ALL);
    d = setSelected(d, 'c-gym', true);
    d = setAmountText(d, 'c-stream', '45,00');
    d = setSelected(d, 'c-power', false);
    const next = [STREAM, cand('c-gym', 'Gym Beta', { defaultSelected: false }), cand('c-new', 'Insurance Gamma', { defaultSelected: true })];
    const r = reconcileDraft(d, ALL, next);
    expect(r.selected).toEqual({ 'c-stream': true, 'c-gym': true, 'c-new': true });
    expect(r.edits).toEqual({ 'c-stream': { amountText: '45,00' } });
  });
});

describe('adjustments', () => {
  it('shows the suggestion and adjusts nothing until the user changes it', () => {
    const r = resolveCandidate(POWER, defaultDraft(ALL));
    expect(r).toMatchObject({ amountText: '187,43', amountCents: 18743, dayText: '20', day: 20, description: 'Power bill', followLast: true });
    expect(r.adjusted).toEqual({ amount: false, day: false, description: false, followLast: false });
    expect(r.errors).toEqual({});
  });

  it('parses the amount in cents; retyping the suggestion is not an adjustment', () => {
    const t = (text: string) => resolveCandidate(STREAM, setAmountText(defaultDraft(ALL), 'c-stream', text));
    expect(t('1.234,56').amountCents).toBe(123456);
    expect(t('R$ 12,5').amountCents).toBe(1250);
    expect(t('39,90').adjusted.amount).toBe(false);
    expect(t('39.9').adjusted.amount).toBe(false);
    expect(t('40').adjusted.amount).toBe(true);
    expect(t('').errors.amount).toBe('empty');
    expect(t('abc').errors.amount).toBe('invalid');
    expect(t('-5').errors.amount).toBe('invalid');
    expect(t('12,345').errors.amount).toBe('invalid');
    expect(t('0').errors.amount).toBe('zero');
    expect(t('0,00').amountCents).toBeNull();
  });

  it('accepts a whole day from 1 to 31', () => {
    const t = (text: string) => resolveCandidate(STREAM, setDayText(defaultDraft(ALL), 'c-stream', text));
    for (const ok of ['1', '15', '31', ' 7 ']) expect(t(ok).errors.day, ok).toBeUndefined();
    for (const bad of ['0', '32', '', '-1', '1.5', 'day', '100']) expect(t(bad).errors.day, bad).toBe('invalid');
    expect(t('5').adjusted.day).toBe(false);
    expect(t('6').adjusted.day).toBe(true);
    expect(t('6').day).toBe(6);
  });

  it('trims the description, requires it and caps it at 500', () => {
    const t = (text: string) => resolveCandidate(STREAM, setDescriptionText(defaultDraft(ALL), 'c-stream', text));
    expect(t('   ').errors.description).toBe('empty');
    expect(t('x'.repeat(501)).errors.description).toBe('long');
    expect(t('x'.repeat(500)).errors.description).toBeUndefined();
    expect(t('  Streaming Alfa  ').adjusted.description).toBe(false);
    expect(t('Streaming Alfa Plus').adjusted.description).toBe(true);
  });

  it('follows the last amount by default (absent counts as on); an adjustment only when it differs from the candidate', () => {
    const noField = cand('c-nofield', 'No field') as Partial<RecurringCandidate>;
    delete noField.followLastAmount;
    expect(candidateFollowsLast(noField as RecurringCandidate)).toBe(true);
    expect(candidateFollowsLast(cand('c-off', 'Off', { followLastAmount: false }))).toBe(false);
    const off = resolveCandidate(STREAM, setFollowLast(defaultDraft([STREAM]), 'c-stream', false));
    expect(off.followLast).toBe(false);
    expect(off.adjusted.followLast).toBe(true);
    expect(resolveCandidate(STREAM, setFollowLast(defaultDraft([STREAM]), 'c-stream', true)).adjusted.followLast).toBe(false);
    const serverOff = cand('c-off', 'Off', { followLastAmount: false });
    expect(resolveCandidate(serverOff, setFollowLast(defaultDraft([serverOff]), 'c-off', true)).adjusted.followLast).toBe(true);
  });

  it('turns "follow the last value" on or off for every candidate at once', () => {
    const d0 = defaultDraft(ALL);
    expect(allFollowLast(d0, ALL)).toBe(true);
    const off = setAllFollowLast(d0, ALL, false);
    expect(allFollowLast(off, ALL)).toBe(false);
    expect(ALL.every((c) => resolveCandidate(c, off).followLast === false)).toBe(true);
    expect(allFollowLast(setFollowLast(d0, 'c-gym', false), ALL)).toBe(false);
    expect(allFollowLast(d0, [])).toBe(false);
  });
});

describe('apply payload and totals', () => {
  it('sends only the ticked candidates, and only the adjusted fields, in reais', () => {
    let d = defaultDraft(ALL);
    d = setAmountText(d, 'c-power', '195,50');
    d = setDayText(d, 'c-power', '25');
    d = setDescriptionText(d, 'c-power', ' Home energy ');
    d = setFollowLast(d, 'c-power', false);
    const built = buildDetectApply('h1', ALL, d);
    expect(built.payload).toEqual({
      householdId: 'h1',
      items: [{ id: 'c-stream' }, { id: 'c-power', amount: 195.5, dayOfMonth: 25, description: 'Home energy', followLastAmount: false }],
    });
    expect(built.items.map((i) => i.candidate.id)).toEqual(['c-stream', 'c-power']);
  });

  it('echoes the detection parameters only when given', () => {
    const built = buildDetectApply('h1', ALL, defaultDraft(ALL), { minMonths: 4, months: 6 });
    expect(Object.keys(built.payload).sort()).toEqual(['householdId', 'items', 'minMonths', 'months']);
    expect(Object.keys(buildDetectApply('h1', ALL, defaultDraft(ALL)).payload).sort()).toEqual(['householdId', 'items']);
  });

  it('never lets an invalid adjustment reach the payload', () => {
    let d = defaultDraft([STREAM]);
    d = setAmountText(d, 'c-stream', 'abc');
    d = setDayText(d, 'c-stream', '40');
    d = setDescriptionText(d, 'c-stream', '');
    expect(buildDetectApply('h1', [STREAM], d).payload.items).toEqual([{ id: 'c-stream' }]);
  });

  it('counts by kind and followers, and sums the month in integer cents', () => {
    let d = setKindSelected(setKindSelected(defaultDraft(ALL), ALL, 'stable', true), ALL, 'bill', true);
    d = setFollowLast(d, 'c-gym', false);
    const { totals } = buildDetectApply('h1', ALL, d);
    expect(totals).toEqual({ count: 4, stableCount: 2, billCount: 2, followCount: 3, monthlyCents: 3990 + 12000 + 18743 + 6450, invalidCount: 0 });
    const typed = setAmountText(defaultDraft(ALL), 'c-stream', '50,00');
    expect(buildDetectApply('h1', ALL, typed).totals.monthlyCents).toBe(5000 + 18743);
  });

  it('keeps sums exact in cents (0.1 + 0.2)', () => {
    const a = cand('a', 'A', { amount: 0.1, minAmount: 0.1, maxAmount: 0.1 });
    const b = cand('b', 'B', { amount: 0.2, minAmount: 0.2, maxAmount: 0.2 });
    expect(buildDetectApply('h1', [a, b], defaultDraft([a, b])).totals.monthlyCents).toBe(30);
  });
});

describe('detectBlocker', () => {
  const ok = buildDetectApply('h1', ALL, defaultDraft(ALL));
  const none = buildDetectApply('h1', ALL, { selected: {}, edits: {} });
  const bad = buildDetectApply('h1', ALL, setDayText(defaultDraft(ALL), 'c-stream', '99'));

  it('ranks applying > needs-refresh > nothing selected > invalid > null', () => {
    expect(detectBlocker(ok, IDLE)).toBeNull();
    expect(detectBlocker(ok, { needsRefresh: false, applying: true })).toBe('applying');
    expect(detectBlocker(ok, { needsRefresh: true, applying: false })).toBe('needs-refresh');
    expect(detectBlocker(none, IDLE)).toBe('none-selected');
    expect(detectBlocker(null, IDLE)).toBe('none-selected');
    expect(detectBlocker(bad, IDLE)).toBe('invalid');
    expect(detectBlocker(none, { needsRefresh: true, applying: false })).toBe('needs-refresh');
  });

  it('is not blocked by an invalid adjustment on an unticked candidate', () => {
    const d = setDayText(defaultDraft(ALL), 'c-gym', '99');
    expect(detectBlocker(buildDetectApply('h1', ALL, d), IDLE)).toBeNull();
  });
});

describe('display helpers', () => {
  it('shows a range only when the amounts varied', () => {
    expect(amountVaried(STREAM)).toBe(false);
    expect(amountVaried(POWER)).toBe(true);
  });

  it('writes the confidence as a clamped percentage', () => {
    expect(confidenceText(0.856)).toBe('86%');
    expect(confidenceText(2)).toBe('100%');
    expect(confidenceText(Number.NaN)).toBe('0%');
  });

  it('tells a refusal (4xx, nothing written) from a failure that may be partial', () => {
    expect(applyRefusedBeforeWriting(403)).toBe(true);
    expect(applyRefusedBeforeWriting(500)).toBe(false);
    expect(applyRefusedBeforeWriting(undefined)).toBe(false);
  });
});
