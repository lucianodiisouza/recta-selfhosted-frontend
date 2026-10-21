/**
 * Pure helpers for the multi-category filter of the Transactions page (fdbk #123).
 * The filter is a list of categoryNames (enum or "CUSTOM:<uuid>"); an empty list means "all".
 */

/** Max categories the backend accepts in `categoryNames`. */
export const MAX_CATEGORY_FILTER = 20;

const LEGACY_ALL = new Set(['', 'todas', 'all']);

/** Splits a comma separated list, dropping blanks, "all" markers and duplicates. */
export function parseCategoryList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(',')) {
    const value = part.trim();
    if (LEGACY_ALL.has(value.toLowerCase()) || out.includes(value)) continue;
    out.push(value);
  }
  return out.slice(0, MAX_CATEGORY_FILTER);
}

/**
 * Reads the filter from the URL: `categories=A,B` (new) and `category=A` (single, old format).
 * Both are merged, so old links keep working.
 */
export function categoriesFromSearchParams(params: URLSearchParams): string[] {
  return parseCategoryList([params.get('categories'), params.get('category')].filter(Boolean).join(','));
}

/** Value for the API `categoryNames` param, or undefined when no category is chosen. */
export function toCategoryNamesParam(categories: string[]): string | undefined {
  const list = parseCategoryList(categories.join(','));
  return list.length ? list.join(',') : undefined;
}

/** Adds the category if missing, removes it otherwise. Keeps the original order. */
export function toggleCategory(categories: string[], value: string): string[] {
  if (!value) return [];
  return categories.includes(value)
    ? categories.filter((c) => c !== value)
    : [...categories, value].slice(0, MAX_CATEGORY_FILTER);
}

/** True when a categoryName passes the filter (OR semantics; empty list lets everything through). */
export function matchesCategories(categoryName: string | null | undefined, categories: string[]): boolean {
  if (categories.length === 0) return true;
  return !!categoryName && categories.includes(categoryName);
}

export interface CategorySummaryStrings {
  /** Label when nothing is chosen. */
  all: string;
  /** e.g. "{{name}} + {{count}}" */
  categoryAndMore: string;
  /** e.g. "{{count}} categorias" */
  categoriesCount: string;
}

/**
 * Trigger/summary text: none = "all", 1 = its name, 2 = "Food + 1", 3 or more = "3 categories".
 */
export function summarizeCategories(
  categories: string[],
  labelOf: (categoryName: string) => string,
  strings: CategorySummaryStrings,
): string {
  if (categories.length === 0) return strings.all;
  if (categories.length === 1) return labelOf(categories[0]);
  if (categories.length === 2) {
    return strings.categoryAndMore.replace('{{name}}', labelOf(categories[0])).replace('{{count}}', '1');
  }
  return strings.categoriesCount.replace('{{count}}', String(categories.length));
}
