import type { Translations } from '../../context/I18nContext';
import { fillTemplate } from '../../utils/fillTemplate';
import { MAX_CATEGORY_NAME, categoryFailure, mergeMoveParts, usageParts } from '../../utils/categoryManager';
import type { CategoryUsage, MergeCounts, NameProblem, UsagePartKey } from '../../utils/categoryManager';

// The words of the category screens: the pure helpers of utils/categoryManager return codes and counts, this turns them
// into the user's language.

function partText(t: Translations, key: UsagePartKey, count: number): string {
  const one = count === 1;
  const template =
    key === 'transactions' ? (one ? t.categoryUsageTransactionOne : t.categoryUsageTransactionMany)
    : key === 'recurring' ? (one ? t.categoryUsageRecurringOne : t.categoryUsageRecurringMany)
    : one ? t.categoryUsageBudgetOne : t.categoryUsageBudgetMany;
  return fillTemplate(template, { count });
}

// Intl.ListFormat words "a, b and c" for each language; the project's TypeScript lib predates its typings (ES2021).
type ListFormatter = new (locale: string, options: { style: 'long'; type: 'conjunction' }) => { format(items: string[]): string };

function joinList(parts: string[], locale: string): string {
  const { ListFormat } = Intl as unknown as { ListFormat?: ListFormatter };
  return ListFormat ? new ListFormat(locale, { style: 'long', type: 'conjunction' }).format(parts) : parts.join(', ');
}

/** "12 transactions, 2 recurrences and 1 budget" (zero parts left out); "Not used" when all are zero. */
export function usageText(t: Translations, locale: string, usage: CategoryUsage | null | undefined): string {
  const parts = usageParts(usage).map((p) => partText(t, p.key, p.count));
  return parts.length === 0 ? t.categoryUsageNone : joinList(parts, locale);
}

/** What a merge moves, as a sentence; the "nothing uses it" variant when there is nothing to move. */
export function mergeMovesText(t: Translations, locale: string, counts: MergeCounts, targetLabel: string): string {
  const parts = mergeMoveParts(counts).map((p) => partText(t, p.key, p.count));
  if (parts.length === 0) return fillTemplate(t.categoryMergeMovesNothing, { target: targetLabel });
  return fillTemplate(t.categoryMergeMoves, { target: targetLabel, list: joinList(parts, locale) });
}

/** Extra line when two monthly budgets meet in the target: their limits are added. */
export function mergeBudgetNoteText(t: Translations, counts: MergeCounts): string | null {
  if (!counts.budgetsCombined) return null;
  return counts.budgetsCombined === 1 ? t.categoryMergeBudgetOne : fillTemplate(t.categoryMergeBudgetMany, { count: counts.budgetsCombined });
}

export function nameProblemText(t: Translations, problem: NameProblem): string {
  switch (problem.code) {
    case 'empty': return t.categoryNameEmpty;
    case 'too-long': return fillTemplate(t.categoryNameTooLong, { max: MAX_CATEGORY_NAME });
    case 'clash-system': return fillTemplate(t.categoryNameClashSystem, { name: problem.label });
    case 'clash-custom': return fillTemplate(t.categoryNameClashCustom, { name: problem.name });
  }
}

/** Message for a failed create/rename/merge/delete, by the server's error code (never a raw slug). */
export function failureText(t: Translations, error: unknown): string {
  const failure = categoryFailure(error);
  if (typeof failure === 'object') return failure.message;
  switch (failure) {
    case 'name-taken': return t.categoryFailNameTaken;
    case 'in-use': return t.categoryDeleteInUse;
    case 'merge-self': return t.categoryFailMergeSelf;
    case 'merge-type-mismatch': return t.categoryFailTypeMismatch;
    case 'merge-target-invalid': return t.categoryFailTargetInvalid;
    case 'not-found': return t.categoryFailNotFound;
    case 'forbidden': return t.categoryFailForbidden;
    case 'unavailable': return t.categoryFailUnavailable;
    case 'other': return t.categoryFailOther;
  }
}
