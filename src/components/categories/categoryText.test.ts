import { describe, expect, it } from 'vitest';
import enUS from '../../i18n/en-US.json';
import ptBR from '../../i18n/pt-BR.json';
import type { Translations } from '../../context/I18nContext';
import { failureText, mergeBudgetNoteText, mergeMovesText, nameProblemText, usageText } from './categoryText';

const en = enUS as unknown as Translations;
const pt = ptBR as unknown as Translations;
const err = (code: string, status?: number) => Object.assign(new Error(code), { code, status });

describe('usageText', () => {
  it('words the non-zero parts with singular and plural, joined by the language', () => {
    expect(usageText(en, 'en-US', { transactions: 12, recurringTransactions: 2, budgets: 1 })).toBe('12 transactions, 2 recurrences, and 1 budget');
    expect(usageText(en, 'en-US', { transactions: 1, recurringTransactions: 0, budgets: 0 })).toBe('1 transaction');
    expect(usageText(en, 'en-US', { transactions: 0, recurringTransactions: 1, budgets: 3 })).toBe('1 recurrence and 3 budgets');
    expect(usageText(pt, 'pt-BR', { transactions: 12, recurringTransactions: 2, budgets: 1 })).toBe('12 transações, 2 recorrências e 1 orçamento');
  });

  it('says "not used" when every count is zero or the counts are missing', () => {
    expect(usageText(en, 'en-US', { transactions: 0, recurringTransactions: 0, budgets: 0 })).toBe('Not used');
    expect(usageText(pt, 'pt-BR', undefined)).toBe('Sem uso');
  });
});

describe('merge preview texts', () => {
  it('counts the budgets that move and the ones that combine together', () => {
    expect(mergeMovesText(en, 'en-US', { transactions: 12, recurringTransactions: 2, budgets: 0, budgetsCombined: 0 }, 'Investments')).toBe('Moves to Investments: 12 transactions and 2 recurrences.');
    expect(mergeMovesText(en, 'en-US', { transactions: 1, recurringTransactions: 1, budgets: 1, budgetsCombined: 1 }, 'Alpha')).toBe('Moves to Alpha: 1 transaction, 1 recurrence, and 2 budgets.');
  });

  it('says nothing uses the category when there is nothing to move', () => {
    expect(mergeMovesText(en, 'en-US', { transactions: 0, recurringTransactions: 0, budgets: 0, budgetsCombined: 0 }, 'Alpha')).toContain('Nothing uses this category');
  });

  it('adds a budget note only when two monthly budgets meet', () => {
    expect(mergeBudgetNoteText(en, { transactions: 1, recurringTransactions: 0, budgets: 1, budgetsCombined: 0 })).toBeNull();
    expect(mergeBudgetNoteText(en, { transactions: 0, recurringTransactions: 0, budgets: 0, budgetsCombined: 1 })).toContain('the two limits will be added');
    expect(mergeBudgetNoteText(en, { transactions: 0, recurringTransactions: 0, budgets: 0, budgetsCombined: 3 })).toContain('3 monthly budgets');
  });
});

describe('nameProblemText', () => {
  it('words every problem, with the clashing name or the limit', () => {
    expect(nameProblemText(en, { code: 'empty' })).toBe('Enter a name.');
    expect(nameProblemText(en, { code: 'too-long' })).toBe('Use at most 100 characters.');
    expect(nameProblemText(en, { code: 'clash-system', label: 'Investments' })).toContain('“Investments”');
    expect(nameProblemText(pt, { code: 'clash-custom', name: 'Vale' })).toContain('“Vale”');
  });
});

describe('failureText', () => {
  it('has a sentence for every server code and never shows the raw code', () => {
    for (const code of ['CATEGORY_NAME_TAKEN', 'CATEGORY_IN_USE', 'CATEGORY_MERGE_SELF', 'CATEGORY_MERGE_TYPE_MISMATCH', 'CATEGORY_MERGE_TARGET_INVALID']) {
      const text = failureText(en, err(code));
      expect(text).not.toContain(code);
      expect(text).toMatch(/[a-z]{4}/);
    }
  });

  it('distinguishes a category that no longer exists from a server without the route', () => {
    expect(failureText(en, err('NOT_FOUND', 404))).toBe(en.categoryFailNotFound);
    expect(failureText(en, Object.assign(new Error('Route not found'), { status: 404 }))).toBe(en.categoryFailUnavailable);
    expect(failureText(en, Object.assign(new Error('x'), { status: 403 }))).toBe(en.categoryFailForbidden);
  });

  it('keeps a readable message, and falls back for a slug or nothing', () => {
    expect(failureText(en, new Error('Network down'))).toBe('Network down');
    expect(failureText(en, new Error('SOME_SLUG'))).toBe(en.categoryFailOther);
    expect(failureText(pt, null)).toBe(pt.categoryFailOther);
  });
});
