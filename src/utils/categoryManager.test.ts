import { describe, expect, it } from 'vitest';
import {
  buildMergeRequest, buildUpdatePatch, categoryFailure, createOptionFor, customValue, groupCategories, mergeMoveParts, mergeTargets,
  normalizeCategoryName, normalizeColor, supportsMerge, usageParts, usageTotal, validateCategoryName,
} from './categoryManager';
import type { CategoryUsage, ManagedCategory } from './categoryManager';

// Invented data only.
const LABELS: Record<string, string> = { SALARY: 'Salary', INVESTMENTS: 'Investments', OTHER_INCOME: 'Other income', FOOD: 'Food', TRANSFER: 'Transfer', ALLOCATION: 'Allocation' };
const label = (c: { id: string }): string => LABELS[c.id] ?? c.id;
const sys = (id: string, type: 'INCOME' | 'EXPENSE', usage?: CategoryUsage): ManagedCategory => ({ id, name: id, type, isSystem: true, usage });
const cus = (id: string, name: string, type: 'INCOME' | 'EXPENSE', usage?: CategoryUsage, color?: string): ManagedCategory => ({ id, name, type, isSystem: false, usage, color });
const ALL: ManagedCategory[] = [
  sys('SALARY', 'INCOME'), sys('INVESTMENTS', 'INCOME', { transactions: 4, recurringTransactions: 0, budgets: 0 }), sys('OTHER_INCOME', 'INCOME'),
  sys('FOOD', 'EXPENSE'), sys('TRANSFER', 'EXPENSE'), sys('ALLOCATION', 'EXPENSE'),
  cus('c-inv', 'Test Investment', 'INCOME', { transactions: 3, recurringTransactions: 1, budgets: 0 }),
  cus('c-voucher', 'Test Voucher', 'INCOME'),
  cus('c-zeta', 'zeta test', 'EXPENSE', { transactions: 0, recurringTransactions: 0, budgets: 2 }),
  cus('c-alpha', 'Alpha test', 'EXPENSE'),
];
const byId = (id: string): ManagedCategory => ALL.find((c) => c.id === id)!;

describe('normalizeCategoryName', () => {
  it('ignores case, accents and spaces but not singular/plural', () => {
    expect(normalizeCategoryName('  Vale   Alimentação ')).toBe('vale alimentacao');
    expect(normalizeCategoryName('INVESTMENTS')).toBe(normalizeCategoryName('investments'));
    expect(normalizeCategoryName('Investment')).not.toBe(normalizeCategoryName('Investments'));
  });
});

describe('groupCategories', () => {
  it('lists income then expense, system and custom apart and sorted, without the movement markers', () => {
    const groups = groupCategories(ALL, label);
    expect(groups.map((g) => g.type)).toEqual(['INCOME', 'EXPENSE']);
    expect(groups[0].system.map((c) => c.id)).toEqual(['INVESTMENTS', 'OTHER_INCOME', 'SALARY']);
    expect(groups[0].custom.map((c) => c.id)).toEqual(['c-inv', 'c-voucher']);
    expect(groups[1].custom.map((c) => c.id)).toEqual(['c-alpha', 'c-zeta']);
    expect(groups[1].system.map((c) => c.id)).toEqual(['FOOD']);
  });
});

describe('usage', () => {
  it('lists the non-zero parts in a fixed order', () => {
    expect(usageParts({ transactions: 12, recurringTransactions: 2, budgets: 1 })).toEqual([
      { key: 'transactions', count: 12 }, { key: 'recurring', count: 2 }, { key: 'budgets', count: 1 },
    ]);
    expect(usageParts({ transactions: 0, recurringTransactions: 1, budgets: 3 })).toEqual([{ key: 'recurring', count: 1 }, { key: 'budgets', count: 3 }]);
    expect(usageParts({ transactions: 0, recurringTransactions: 0, budgets: 0 })).toEqual([]);
    expect(usageParts(undefined)).toEqual([]);
  });

  it('totals the three tables: any of them keeps the category from being deleted', () => {
    expect(usageTotal({ transactions: 0, recurringTransactions: 0, budgets: 2 })).toBe(2);
    expect(usageTotal({ transactions: 0, recurringTransactions: 0, budgets: 0 })).toBe(0);
    expect(usageTotal(null)).toBe(0);
  });

  it('counts the budgets that move and the ones that combine together in a merge', () => {
    expect(mergeMoveParts({ transactions: 1, recurringTransactions: 1, budgets: 1, budgetsCombined: 1 })).toEqual([
      { key: 'transactions', count: 1 }, { key: 'recurring', count: 1 }, { key: 'budgets', count: 2 },
    ]);
    expect(mergeMoveParts({ transactions: 0, recurringTransactions: 0, budgets: 0, budgetsCombined: 0 })).toEqual([]);
  });

  it('knows a server that predates the merge feature by the missing usage counts', () => {
    expect(supportsMerge(ALL)).toBe(true);
    expect(supportsMerge([sys('SALARY', 'INCOME'), cus('c', 'Old server', 'INCOME')])).toBe(false);
    expect(supportsMerge([{ ...sys('SALARY', 'INCOME'), usage: null }])).toBe(false);
    expect(supportsMerge([])).toBe(false);
  });
});

describe('mergeTargets and buildMergeRequest', () => {
  it('offers the same type only, never itself, custom first then system, without the movement markers', () => {
    const targets = mergeTargets(byId('c-inv'), ALL, label);
    expect(targets.map((t) => `${t.kind}:${t.id}`)).toEqual(['custom:c-voucher', 'system:INVESTMENTS', 'system:OTHER_INCOME', 'system:SALARY']);
    expect(mergeTargets(byId('c-alpha'), ALL, label).map((t) => `${t.kind}:${t.id}`)).toEqual(['custom:c-zeta', 'system:FOOD']);
  });

  it('offers nothing for a system category as the source', () => {
    expect(mergeTargets(byId('INVESTMENTS'), ALL, label)).toEqual([]);
  });

  it('names a custom target by id and a system target by enum value; ?preview=true only for the preview', () => {
    const custom = { kind: 'custom' as const, id: 'c-voucher', label: 'Test Voucher' };
    const system = { kind: 'system' as const, id: 'INVESTMENTS', label: 'Investments' };
    expect(buildMergeRequest('c-inv', custom, true)).toEqual({ url: '/categories/c-inv/merge?preview=true', body: { targetCategoryId: 'c-voucher' } });
    expect(buildMergeRequest('c-inv', system, false)).toEqual({ url: '/categories/c-inv/merge', body: { targetSystemName: 'INVESTMENTS' } });
  });
});

describe('validateCategoryName', () => {
  it('refuses empty and too long names', () => {
    expect(validateCategoryName('   ', 'INCOME', ALL, label)).toMatchObject({ ok: false, problem: { code: 'empty' } });
    expect(validateCategoryName('x'.repeat(101), 'INCOME', ALL, label)).toMatchObject({ ok: false, problem: { code: 'too-long' } });
  });

  it('refuses a name equal to a system or custom category of the same type, saying which', () => {
    expect(validateCategoryName('investments', 'INCOME', ALL, label)).toMatchObject({ ok: false, problem: { code: 'clash-system', label: 'Investments' } });
    expect(validateCategoryName(' TEST   investment ', 'INCOME', ALL, label)).toMatchObject({ ok: false, problem: { code: 'clash-custom', name: 'Test Investment' } });
  });

  it('accepts a different singular/plural, a name used by the other type, and trims the result', () => {
    expect(validateCategoryName('Investment', 'INCOME', ALL, label).ok).toBe(true);
    expect(validateCategoryName('Food', 'INCOME', ALL, label).ok).toBe(true);
    expect(validateCategoryName('  New   Voucher ', 'INCOME', ALL, label).name).toBe('New Voucher');
  });

  it('ignores the category being renamed (only the letter case changes) but not the others', () => {
    expect(validateCategoryName('test investment', 'INCOME', ALL, label, 'c-inv').ok).toBe(true);
    expect(validateCategoryName('test voucher', 'INCOME', ALL, label, 'c-inv').ok).toBe(false);
  });
});

describe('createOptionFor', () => {
  const options = [{ value: 'INVESTMENTS', display: 'Investments' }, { value: 'CUSTOM:c-voucher', display: 'Test Voucher' }];

  it('is offered for text that matches nothing, trimmed', () => {
    expect(createOptionFor('  New   Voucher ', options)).toEqual({ name: 'New Voucher' });
  });

  it('is not offered for a match, empty text or a name that is too long', () => {
    expect(createOptionFor('investments', options)).toBeNull();
    expect(createOptionFor('TEST voucher', options)).toBeNull();
    expect(createOptionFor('   ', options)).toBeNull();
    expect(createOptionFor('x'.repeat(101), options)).toBeNull();
  });

  it('is not blocked by the "all" option, whose value is empty', () => {
    expect(createOptionFor('All', [{ value: '', display: 'All' }])).toEqual({ name: 'All' });
  });
});

describe('customValue', () => {
  it('is the value stored in rows', () => expect(customValue('abc')).toBe('CUSTOM:abc'));
});

describe('categoryFailure', () => {
  it('maps every server code to a failure kind, never a raw code', () => {
    const fail = (code: string) => categoryFailure(Object.assign(new Error(code), { code }));
    expect(fail('CATEGORY_NAME_TAKEN')).toBe('name-taken');
    expect(fail('CATEGORY_IN_USE')).toBe('in-use');
    expect(fail('CATEGORY_MERGE_SELF')).toBe('merge-self');
    expect(fail('CATEGORY_MERGE_TYPE_MISMATCH')).toBe('merge-type-mismatch');
    expect(fail('CATEGORY_MERGE_TARGET_INVALID')).toBe('merge-target-invalid');
  });

  it('tells a missing category (app 404) from a missing route (framework 404/405, no app code)', () => {
    expect(categoryFailure(Object.assign(new Error('Category not found'), { status: 404, code: 'NOT_FOUND' }))).toBe('not-found');
    expect(categoryFailure(Object.assign(new Error('Route not found'), { status: 404 }))).toBe('unavailable');
    expect(categoryFailure(Object.assign(new Error('Method not allowed'), { status: 405 }))).toBe('unavailable');
  });

  it('maps 403 to forbidden and keeps a real message, but never a slug', () => {
    expect(categoryFailure(Object.assign(new Error('x'), { status: 403 }))).toBe('forbidden');
    expect(categoryFailure(new Error('Network down'))).toEqual({ message: 'Network down' });
    expect(categoryFailure(new Error('SOME_SLUG'))).toBe('other');
    expect(categoryFailure(null)).toBe('other');
  });
});

describe('normalizeColor and buildUpdatePatch', () => {
  it('accepts #RRGGBB only', () => {
    expect(normalizeColor('#aabbcc')).toBe('#AABBCC');
    expect(normalizeColor('red')).toBeNull();
    expect(normalizeColor(null)).toBeNull();
  });

  it('sends only the fields that changed', () => {
    expect(buildUpdatePatch({ name: 'A', color: '#112233' }, { name: 'A', color: '#112233' })).toBeNull();
    expect(buildUpdatePatch({ name: 'A', color: '#112233' }, { name: 'B', color: '#112233' })).toEqual({ name: 'B' });
    expect(buildUpdatePatch({ name: 'A', color: null }, { name: 'A', color: '#112233' })).toEqual({ color: '#112233' });
    expect(buildUpdatePatch({ name: 'A', color: '#112233' }, { name: 'A', color: null })).toEqual({ color: null });
    expect(buildUpdatePatch({ name: 'A', color: undefined }, { name: 'A', color: null })).toBeNull();
  });
});
