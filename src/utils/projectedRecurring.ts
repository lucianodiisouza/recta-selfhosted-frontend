import type { RecurringProjection } from '../hooks/api/useRecurringTransactions';
import { matchesCategories, parseCategoryList } from './categoryFilter';

/**
 * Pure helpers for the projected recurring occurrences shown in the "Future transactions" tab
 * (fdbk #116). Projections are display-only: they never enter totals, selection or export.
 */

export interface ProjectionFilters {
  /** 'todos' | 'INCOME' | 'EXPENSE' (the page's type filter values) */
  type: string;
  /**
   * Categories to keep (enum or "CUSTOM:<id>"); a projection passes when its category is any of them
   * (fdbk #123). Empty list, '' or 'todas' = all. A single string is still accepted.
   */
  category: string[] | string;
  /** Free text; matches description, category label and amount. */
  search: string;
  /** 'todos' | 'paid' | 'pending'. Projections are not paid, so 'paid' hides them all. */
  paid: string;
}

const amountMatches = (amount: number, query: string): boolean => {
  const numeric = query.replace(/[^\d.,]/g, '');
  if (!numeric) return false;
  const normalized = numeric.replace(',', '.');
  const value = parseFloat(normalized);
  if (isNaN(value) || !isFinite(value)) return false;
  const abs = Math.abs(amount);
  return Math.abs(abs - value) < 0.01 || abs.toString().includes(normalized) || abs.toString().includes(numeric);
};

/** Applies the tab filters to the projections, the same way they apply to real rows. */
export function filterProjections(
  items: RecurringProjection[],
  filters: ProjectionFilters,
  categoryLabel: (categoryName: string) => string = (name) => name,
): RecurringProjection[] {
  if (filters.paid === 'paid') return [];
  const query = filters.search.trim().toLowerCase();
  const categories = Array.isArray(filters.category) ? filters.category : parseCategoryList(filters.category);
  return items.filter((p) => {
    if (filters.type !== 'todos' && p.type !== filters.type) return false;
    if (!matchesCategories(p.categoryName, categories)) return false;
    if (query) {
      const inDescription = (p.description ?? '').toLowerCase().includes(query);
      const inCategory = categoryLabel(p.categoryName).toLowerCase().includes(query);
      const inAmount = /[\d]/.test(query) && amountMatches(p.amount, query);
      if (!inDescription && !inCategory && !inAmount) return false;
    }
    return true;
  });
}

export interface DayGroup<T> {
  dateKey: string;
  date: Date;
  transactions: T[];
  projections: RecurringProjection[];
}

/**
 * Merges projections into the day groups of the real list (newest day first, like the tab).
 * Days that only have projections get their own group; within a day real rows come first.
 */
export function mergeProjectionsIntoGroups<T>(
  groups: Array<{ dateKey: string; date: Date; transactions: T[] }>,
  projections: RecurringProjection[],
  parseDateKey: (dateKey: string) => Date,
): DayGroup<T>[] {
  const byKey = new Map<string, DayGroup<T>>();
  for (const g of groups) byKey.set(g.dateKey, { ...g, projections: [] });
  for (const p of projections) {
    const key = p.date.slice(0, 10);
    let group = byKey.get(key);
    if (!group) {
      group = { dateKey: key, date: parseDateKey(key), transactions: [], projections: [] };
      byKey.set(key, group);
    }
    group.projections.push(p);
  }
  return Array.from(byKey.values()).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}
