// Pure rules of the category manager (Settings), the merge dialog and the inline "Create" option of the category
// combobox. No React and no text here: validation and failures are codes the components translate.

export type CategoryKind = 'INCOME' | 'EXPENSE';

export const MAX_CATEGORY_NAME = 100;
export const DEFAULT_CATEGORY_COLOR = '#64748B';
export const CUSTOM_PREFIX = 'CUSTOM:';

export interface CategoryUsage {
  transactions: number;
  recurringTransactions: number;
  budgets: number;
}

/** One row of GET /categories?includeUsage=true. */
export interface ManagedCategory {
  id: string;
  name: string;
  type: CategoryKind;
  color?: string | null;
  icon?: string | null;
  isSystem: boolean;
  usage?: CategoryUsage | null;
}

const NO_USAGE: CategoryUsage = { transactions: 0, recurringTransactions: 0, budgets: 0 };

/** Case, accent and extra-space insensitive form of a name (the server compares names the same way). */
export function normalizeCategoryName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function usageOf(category: ManagedCategory): CategoryUsage {
  return category.usage ?? NO_USAGE;
}

export function usageTotal(usage: CategoryUsage | null | undefined): number {
  return usage ? usage.transactions + usage.recurringTransactions + usage.budgets : 0;
}

/**
 * Whether the server answers with usage counts, which only a server that has the merge feature does. The manager offers
 * "merge" (and the usage text) only then; against an older server it still lists, creates, renames and deletes.
 */
export function supportsMerge(categories: readonly ManagedCategory[]): boolean {
  return categories.some((c) => c.usage !== undefined && c.usage !== null);
}

export type UsagePartKey = 'transactions' | 'recurring' | 'budgets';

/** The non-zero parts of a usage, in a fixed order: the caller words each one with its translations. */
export function usageParts(usage: CategoryUsage | null | undefined): Array<{ key: UsagePartKey; count: number }> {
  const parts: Array<{ key: UsagePartKey; count: number }> = [];
  if (usage?.transactions) parts.push({ key: 'transactions', count: usage.transactions });
  if (usage?.recurringTransactions) parts.push({ key: 'recurring', count: usage.recurringTransactions });
  if (usage?.budgets) parts.push({ key: 'budgets', count: usage.budgets });
  return parts;
}

export interface CategoryGroup {
  type: CategoryKind;
  system: ManagedCategory[];
  custom: ManagedCategory[];
}

const byText = (a: string, b: string, locale: string): number => a.localeCompare(b, locale, { sensitivity: 'base' });

/** Income first, then expense; each with system (by label) and custom (by name) lists. Movement markers are not listed. */
export function groupCategories(
  categories: ManagedCategory[],
  systemLabel: (category: ManagedCategory) => string,
  locale = 'en-US',
): CategoryGroup[] {
  return (['INCOME', 'EXPENSE'] as const).map((type) => ({
    type,
    system: categories
      .filter((c) => c.isSystem && c.type === type && c.id !== 'TRANSFER' && c.id !== 'ALLOCATION')
      .sort((a, b) => byText(systemLabel(a), systemLabel(b), locale)),
    custom: categories.filter((c) => !c.isSystem && c.type === type).sort((a, b) => byText(a.name, b.name, locale)),
  }));
}

export interface MergeTargetOption {
  /** Request field: targetCategoryId (custom) or targetSystemName (system). */
  kind: 'custom' | 'system';
  id: string;
  label: string;
}

/** Where a category can be merged into: same type, never itself; custom ones first, then the system ones. */
export function mergeTargets(
  source: ManagedCategory,
  categories: ManagedCategory[],
  systemLabel: (category: ManagedCategory) => string,
  locale = 'en-US',
): MergeTargetOption[] {
  if (source.isSystem) return [];
  const sameType = categories.filter((c) => c.type === source.type && c.id !== source.id && c.id !== 'TRANSFER' && c.id !== 'ALLOCATION');
  const custom = sameType.filter((c) => !c.isSystem).map((c): MergeTargetOption => ({ kind: 'custom', id: c.id, label: c.name }));
  const system = sameType.filter((c) => c.isSystem).map((c): MergeTargetOption => ({ kind: 'system', id: c.id, label: systemLabel(c) }));
  const sort = (list: MergeTargetOption[]) => list.sort((a, b) => byText(a.label, b.label, locale));
  return [...sort(custom), ...sort(system)];
}

export interface MergeRequest {
  url: string;
  body: { targetCategoryId: string } | { targetSystemName: string };
}

export function buildMergeRequest(sourceId: string, target: MergeTargetOption, preview: boolean): MergeRequest {
  return {
    url: `/categories/${sourceId}/merge${preview ? '?preview=true' : ''}`,
    body: target.kind === 'custom' ? { targetCategoryId: target.id } : { targetSystemName: target.id },
  };
}

export interface MergeCounts {
  transactions: number;
  recurringTransactions: number;
  budgets: number;
  budgetsCombined: number;
}

/** What a merge moves, for the preview sentence: budgets that move and budgets that combine count together. */
export function mergeMoveParts(counts: MergeCounts): Array<{ key: UsagePartKey; count: number }> {
  return usageParts({ transactions: counts.transactions, recurringTransactions: counts.recurringTransactions, budgets: counts.budgets + counts.budgetsCombined });
}

export type NameProblem =
  | { code: 'empty' }
  | { code: 'too-long' }
  | { code: 'clash-system'; label: string }
  | { code: 'clash-custom'; name: string };

export interface ValidatedName {
  ok: boolean;
  name: string;
  problem?: NameProblem;
}

/**
 * Checks a new or renamed name against the categories already listed (same type): empty, too long, or the same as another
 * category once case, accents and spaces are ignored. `ignoreId` is the category being renamed.
 */
export function validateCategoryName(
  raw: string,
  type: CategoryKind,
  categories: ManagedCategory[],
  systemLabel: (category: ManagedCategory) => string,
  ignoreId?: string | null,
): ValidatedName {
  const name = raw.replace(/\s+/g, ' ').trim();
  if (!name) return { ok: false, name, problem: { code: 'empty' } };
  if (name.length > MAX_CATEGORY_NAME) return { ok: false, name, problem: { code: 'too-long' } };
  const wanted = normalizeCategoryName(name);
  const clash = categories.find(
    (c) => c.type === type && c.id !== ignoreId && normalizeCategoryName(c.isSystem ? systemLabel(c) : c.name) === wanted,
  );
  if (clash) {
    return { ok: false, name, problem: clash.isSystem ? { code: 'clash-system', label: systemLabel(clash) } : { code: 'clash-custom', name: clash.name } };
  }
  return { ok: true, name };
}

export interface ComboOption {
  value: string;
  display: string;
}

/** The "Create" option of the combobox: offered when something was typed and no listed option has that name. */
export function createOptionFor(search: string, options: ComboOption[]): { name: string } | null {
  const name = search.replace(/\s+/g, ' ').trim();
  if (!name || name.length > MAX_CATEGORY_NAME) return null;
  const wanted = normalizeCategoryName(name);
  if (options.some((o) => o.value !== '' && normalizeCategoryName(o.display) === wanted)) return null;
  return { name };
}

/** The value stored in transactions/recurrences for a custom category id. */
export function customValue(id: string): string {
  return `${CUSTOM_PREFIX}${id}`;
}

export type CategoryFailure =
  | 'name-taken'
  | 'in-use'
  | 'merge-self'
  | 'merge-type-mismatch'
  | 'merge-target-invalid'
  | 'not-found'
  | 'forbidden'
  | 'unavailable'
  | { message: string }
  | 'other';

/**
 * What a failed create/rename/merge/delete means, by the server's error code (never the raw slug). `unavailable` is a
 * framework 404/405 with no app code: the server has no such route.
 */
export function categoryFailure(error: unknown): CategoryFailure {
  const e = error as { code?: string; status?: number; message?: string } | null;
  switch (e?.code) {
    case 'CATEGORY_NAME_TAKEN': return 'name-taken';
    case 'CATEGORY_IN_USE': return 'in-use';
    case 'CATEGORY_MERGE_SELF': return 'merge-self';
    case 'CATEGORY_MERGE_TYPE_MISMATCH': return 'merge-type-mismatch';
    case 'CATEGORY_MERGE_TARGET_INVALID': return 'merge-target-invalid';
    default: break;
  }
  if (e?.status === 404 && e.code === undefined) return 'unavailable';
  if (e?.status === 404) return 'not-found';
  if (e?.status === 405 && e.code === undefined) return 'unavailable';
  if (e?.status === 403) return 'forbidden';
  return e?.message && !/^[A-Z_]+$/.test(e.message) ? { message: e.message } : 'other';
}

/** Normalizes a color typed or picked to #RRGGBB, or null when it is not one. */
export function normalizeColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : null;
}

export const CATEGORY_COLORS = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#14B8A6', '#3B82F6', '#6366F1', '#A855F7', '#EC4899', '#64748B'] as const;

/** What PATCH carries: only the fields that changed. null when nothing changed. */
export function buildUpdatePatch(
  original: { name: string; color?: string | null },
  next: { name: string; color: string | null },
): { name?: string; color?: string | null } | null {
  const patch: { name?: string; color?: string | null } = {};
  if (next.name !== original.name) patch.name = next.name;
  const before = normalizeColor(original.color) ?? null;
  if ((next.color ?? null) !== before) patch.color = next.color;
  return Object.keys(patch).length > 0 ? patch : null;
}
