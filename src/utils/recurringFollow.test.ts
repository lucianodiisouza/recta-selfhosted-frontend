import { describe, expect, it } from 'vitest';
import {
  LATEST_WINDOW_DAYS, addDaysKey, amountChanged, dayKey, recurrenceUpdatedAmount, showsFollowLastHint,
} from './recurringFollow';
import type { OccurrenceRef, RecurrenceRef } from './recurringFollow';

const TODAY = new Date(2026, 9, 5); // 2026-10-05 (local)
const REC_FOLLOW: RecurrenceRef = { id: 'rec-1', followLastAmount: true };
const REC_FIXED: RecurrenceRef = { id: 'rec-2', followLastAmount: false };
const occ = (id: string, date: string | Date, recurringTransactionId: string | null = 'rec-1'): OccurrenceRef => ({ id, date, recurringTransactionId });
const OLD = occ('t-aug', '2026-08-10');
const MID = occ('t-sep', '2026-09-10');
const LATEST = occ('t-oct', '2026-10-10');
const KNOWN = [LATEST, MID, OLD, occ('t-other', '2026-10-20', 'rec-2'), occ('t-plain', '2026-10-25', null)];
const withLast = (last: string | null | undefined): RecurrenceRef => ({ id: 'rec-1', followLastAmount: true, ...(last === undefined ? {} : { lastOccurrenceDate: last }) });

describe('showsFollowLastHint (without the server date)', () => {
  it('shows for the most recent occurrence of a recurrence that follows the last amount', () => {
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], KNOWN, TODAY)).toBe(true);
  });

  it('does not show for an older occurrence: editing it does not change the recurrence', () => {
    expect(showsFollowLastHint(MID, [REC_FOLLOW], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint(OLD, [REC_FOLLOW], KNOWN, TODAY)).toBe(false);
  });

  it('does not show when the recurrence does not follow, is unknown, or the transaction has none', () => {
    expect(showsFollowLastHint(occ('t-oct', '2026-10-10', 'rec-2'), [REC_FIXED], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint(LATEST, [], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint(LATEST, [{ id: 'rec-1' }], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint(occ('t-plain', '2026-10-25', null), [REC_FOLLOW], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint({ id: 't-n', date: '2026-10-10' }, [{ followLastAmount: true }], KNOWN, TODAY)).toBe(false);
    expect(showsFollowLastHint(null, [REC_FOLLOW], KNOWN, TODAY)).toBe(false);
  });

  it('ignores occurrences of other recurrences when looking for a later one', () => {
    const known = [LATEST, occ('t-x', '2026-10-30', 'rec-2'), occ('t-y', '2026-10-31', null)];
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], known, TODAY)).toBe(true);
  });

  it('uses a window of today + 31 days', () => {
    expect(LATEST_WINDOW_DAYS).toBe(31);
    const far = occ('t-far', '2026-12-15');
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], [LATEST, far, MID], TODAY)).toBe(true);
    expect(showsFollowLastHint(far, [REC_FOLLOW], [LATEST, far, MID], TODAY)).toBe(false);
    const edge = occ('t-edge', '2026-11-05');
    expect(showsFollowLastHint(edge, [REC_FOLLOW], [edge, MID], TODAY)).toBe(true);
    const past = occ('t-past', '2026-11-06');
    expect(showsFollowLastHint(past, [REC_FOLLOW], [past, MID], TODAY)).toBe(false);
  });

  it('lets same-day siblings through but not a later sibling', () => {
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], [LATEST, occ('t-twin', '2026-10-10')], TODAY)).toBe(true);
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], [LATEST, occ('t-later', '2026-10-11')], TODAY)).toBe(false);
  });

  it('cannot judge a transaction older than everything the client knows, nor an empty list', () => {
    const ancient = occ('t-2024', '2024-01-10');
    expect(showsFollowLastHint(ancient, [REC_FOLLOW], KNOWN, TODAY)).toBe(false);
    const noSibling = [occ('t-x', '2026-09-10', 'rec-2')];
    expect(showsFollowLastHint(ancient, [REC_FOLLOW], noSibling, TODAY)).toBe(false);
    expect(showsFollowLastHint(occ('t-2026', '2026-09-10'), [REC_FOLLOW], noSibling, TODAY)).toBe(true);
    expect(showsFollowLastHint(LATEST, [REC_FOLLOW], [], TODAY)).toBe(false);
  });

  it('compares Date objects (local day) and ISO timestamps by day', () => {
    const asDate = occ('t-oct', new Date(2026, 9, 10));
    const iso = occ('t-sep', '2026-09-10T00:00:00.000Z');
    expect(showsFollowLastHint(asDate, [REC_FOLLOW], [asDate, iso], TODAY)).toBe(true);
    expect(showsFollowLastHint(iso, [REC_FOLLOW], [asDate, iso], TODAY)).toBe(false);
  });
});

describe('showsFollowLastHint (with lastOccurrenceDate from the server)', () => {
  it('shows when the edited occurrence is the newest: own >= last and own <= today + 31', () => {
    expect(showsFollowLastHint(LATEST, [withLast('2026-10-10')], [], TODAY)).toBe(true);
    expect(showsFollowLastHint(LATEST, [withLast('2026-10-09')], [], TODAY)).toBe(true);
    expect(showsFollowLastHint(MID, [withLast('2026-10-10')], [MID], TODAY)).toBe(false);
    expect(showsFollowLastHint(LATEST, [withLast('2026-10-11')], [LATEST], TODAY)).toBe(false);
  });

  it('lets the server date win over what the client holds', () => {
    expect(showsFollowLastHint(MID, [withLast('2026-09-10')], [MID, LATEST], TODAY)).toBe(true);
    expect(showsFollowLastHint(OLD, [withLast('2026-10-10')], [OLD], TODAY)).toBe(false);
  });

  it('gives no hint for null (nothing in the window) or past today + 31', () => {
    expect(showsFollowLastHint(LATEST, [withLast(null)], [LATEST], TODAY)).toBe(false);
    const far = occ('t-far', '2026-12-15');
    expect(showsFollowLastHint(far, [withLast('2026-10-10')], [far], TODAY)).toBe(false);
    const edge = occ('t-edge', '2026-11-05');
    expect(showsFollowLastHint(edge, [withLast('2026-11-05')], [edge], TODAY)).toBe(true);
    const past = occ('t-past', '2026-11-06');
    expect(showsFollowLastHint(past, [withLast('2026-11-06')], [past], TODAY)).toBe(false);
  });

  it('still needs the flag and the recurrence id', () => {
    expect(showsFollowLastHint(LATEST, [{ id: 'rec-1', followLastAmount: false, lastOccurrenceDate: '2026-10-10' }], [], TODAY)).toBe(false);
    expect(showsFollowLastHint(occ('t-x', '2026-10-10', null), [withLast('2026-10-10')], [], TODAY)).toBe(false);
  });

  it('falls back to the heuristic when the field is absent', () => {
    expect(showsFollowLastHint(LATEST, [withLast(undefined)], KNOWN, TODAY)).toBe(true);
    expect(showsFollowLastHint(MID, [withLast(undefined)], KNOWN, TODAY)).toBe(false);
  });
});

describe('dayKey and addDaysKey', () => {
  it('reads the day of a Date (local) or a string (date part)', () => {
    expect(dayKey(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(dayKey('2026-01-05T23:00:00Z')).toBe('2026-01-05');
    expect(dayKey('nope')).toBe('');
    expect(dayKey(new Date(Number.NaN))).toBe('');
    expect(dayKey(null)).toBe('');
  });

  it('adds days across a year boundary', () => {
    expect(addDaysKey(new Date(2026, 11, 20), 31)).toBe('2027-01-20');
  });
});

describe('amountChanged', () => {
  it('compares in integer cents, so float noise is not a change', () => {
    expect(amountChanged(187.43, 187.43)).toBe(false);
    expect(amountChanged(0.1 + 0.2, 0.3)).toBe(false);
    expect(amountChanged(100, 100.01)).toBe(true);
    expect(amountChanged(100, 0)).toBe(true);
    expect(amountChanged(undefined, 50)).toBe(true);
    expect(amountChanged(50, undefined)).toBe(true);
    expect(amountChanged(undefined, undefined)).toBe(false);
  });
});

describe('recurrenceUpdatedAmount', () => {
  it('returns the amount only for a valid notice', () => {
    expect(recurrenceUpdatedAmount({ id: 'rec-1', amount: 187.43 })).toBe(187.43);
    expect(recurrenceUpdatedAmount(undefined)).toBeNull();
    expect(recurrenceUpdatedAmount(null)).toBeNull();
    expect(recurrenceUpdatedAmount({ id: '', amount: 10 })).toBeNull();
    expect(recurrenceUpdatedAmount({ id: 'rec-1', amount: 'x' })).toBeNull();
    expect(recurrenceUpdatedAmount({ id: 'rec-1', amount: null })).toBeNull();
    expect(recurrenceUpdatedAmount({ id: 'rec-1', amount: Number.NaN })).toBeNull();
  });
});
