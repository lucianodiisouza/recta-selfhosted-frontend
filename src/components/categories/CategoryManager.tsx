import { useMemo, useState } from 'react';
import { Merge, Pencil, Plus, Tag, Trash2 } from 'lucide-react';
import { useCategories, useDeleteCategory } from '../../hooks/api/useCategories';
import { useToastContext } from '../../context/ToastContext';
import { useI18n } from '../../context/I18nContext';
import { getCategoryDisplayName } from '../../lib/enums';
import { fillTemplate } from '../../utils/fillTemplate';
import ConfirmModal from '../ConfirmModal';
import {
  DEFAULT_CATEGORY_COLOR,
  groupCategories,
  normalizeColor,
  supportsMerge,
  usageOf,
  usageTotal,
} from '../../utils/categoryManager';
import type { CategoryKind, ManagedCategory } from '../../utils/categoryManager';
import { BTN_PRIMARY, BTN_SECONDARY_SM, MUTED_CLS } from './dialogUi';
import { failureText, usageText } from './categoryText';
import CategoryFormDialog from './CategoryFormDialog';
import CategoryMergeDialog from './CategoryMergeDialog';

interface CategoryManagerProps {
  householdId: string | undefined;
  /** EDITOR or more; a viewer only reads. */
  canEdit: boolean;
}

const Dot = ({ color }: { color?: string | null }) => (
  <span className="inline-block h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: normalizeColor(color) ?? DEFAULT_CATEGORY_COLOR }} aria-hidden="true" />
);

const BADGE_CLS = 'text-xs px-2 py-0.5 rounded-full border border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 font-light whitespace-nowrap';

/**
 * Settings section: system categories (read-only) and the user's own, by income / expense, with how much each one is
 * used. Create, rename, recolor, merge into another category of the same type, delete when unused. Against a server that
 * predates the merge feature (no usage counts in the list) it still lists, creates, renames and deletes, without the
 * usage text and the merge action.
 */
const CategoryManager = ({ householdId, canEdit }: CategoryManagerProps) => {
  const { t, locale } = useI18n();
  const { success, error: showError } = useToastContext();
  const { data: list = [], isLoading, isError } = useCategories({ householdId, includeUsage: true });
  const deleteMutation = useDeleteCategory();
  const categories = list as ManagedCategory[];
  const mergeAvailable = supportsMerge(categories);
  const systemLabel = useMemo(() => (c: ManagedCategory) => getCategoryDisplayName(c.id, t as unknown as Record<string, string>), [t]);
  const groups = useMemo(() => groupCategories(categories, systemLabel, locale), [categories, systemLabel, locale]);

  const [form, setForm] = useState<{ category: ManagedCategory | null; type: CategoryKind } | null>(null);
  const [mergeSource, setMergeSource] = useState<ManagedCategory | null>(null);
  const [deleting, setDeleting] = useState<ManagedCategory | null>(null);

  const confirmDelete = async () => {
    if (!deleting || deleteMutation.isPending) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      success(t.categoryManagerDeleted);
      setDeleting(null);
    } catch (err: unknown) {
      showError(failureText(t, err));
      setDeleting(null);
    }
  };

  const title = (type: CategoryKind): string => (type === 'INCOME' ? t.income : t.expense);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
      <div className="flex items-start justify-between gap-3 mb-4">
        <h2 className="text-lg sm:text-xl font-light tracking-tight text-gray-900 dark:text-white flex items-center">
          <Tag className="h-5 w-5 mr-2" />
          {t.manageCategories}
        </h2>
        {canEdit && (
          <button type="button" onClick={() => setForm({ category: null, type: 'EXPENSE' })} className={`${BTN_PRIMARY} gap-2 !px-3 !py-2`}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t.addCategory}
          </button>
        )}
      </div>
      <p className={`text-sm font-light mb-4 ${MUTED_CLS}`}>{t.categoryManagerIntro}</p>

      {isLoading && <p className={`text-sm ${MUTED_CLS}`} role="status">{t.categoryManagerLoading}</p>}
      {isError && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{t.categoryManagerLoadFailed}</p>}

      {groups.map((group) => (
        <section key={group.type} className="mb-6 last:mb-0" aria-label={title(group.type)}>
          <h3 className={`text-sm font-medium mb-2 ${group.type === 'INCOME' ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{title(group.type)}</h3>
          <ul className="space-y-2">
            {group.custom.map((c) => {
              const used = usageTotal(c.usage) > 0;
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md border border-gray-100 dark:border-gray-800">
                  <span className="flex items-center gap-2 min-w-0">
                    <Dot color={c.color} />
                    <span className="font-light text-gray-900 dark:text-white truncate">{c.name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {mergeAvailable && <span className={`text-xs font-light ${MUTED_CLS}`}>{usageText(t, locale, usageOf(c))}</span>}
                    {canEdit && (
                      <>
                        <button type="button" onClick={() => setForm({ category: c, type: c.type })} className="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
                          aria-label={fillTemplate(t.categoryManagerEditAria, { name: c.name })} title={t.edit}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        {mergeAvailable && (
                          <button type="button" onClick={() => setMergeSource(c)} className="p-1.5 text-gray-500 hover:text-primary-600 dark:hover:text-primary-400"
                            aria-label={fillTemplate(t.categoryManagerMergeAria, { name: c.name })} title={fillTemplate(t.categoryManagerMergeAria, { name: c.name })}>
                            <Merge className="h-4 w-4" />
                          </button>
                        )}
                        {used ? (
                          <span className="text-xs text-gray-400 dark:text-gray-500" title={t.categoryManagerInUseHint}>{t.categoryManagerInUse}</span>
                        ) : (
                          <button type="button" onClick={() => setDeleting(c)} className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                            aria-label={fillTemplate(t.categoryManagerDeleteAria, { name: c.name })} title={t.delete}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </>
                    )}
                  </span>
                </li>
              );
            })}
            {group.custom.length === 0 && !isLoading && (
              <li className={`text-sm font-light ${MUTED_CLS}`}>{group.type === 'INCOME' ? t.categoryManagerNoneIncome : t.categoryManagerNoneExpense}</li>
            )}
            {group.system.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 px-3 rounded-md border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <span className="flex items-center gap-2 min-w-0">
                  <Dot color={c.color} />
                  <span className="font-light text-gray-900 dark:text-white truncate">{systemLabel(c)}</span>
                  <span className={BADGE_CLS}>{t.categoryManagerDefaultBadge}</span>
                </span>
                {mergeAvailable && <span className={`text-xs font-light ${MUTED_CLS}`}>{usageText(t, locale, usageOf(c))}</span>}
              </li>
            ))}
          </ul>
          {canEdit && (
            <button type="button" onClick={() => setForm({ category: null, type: group.type })} className={`${BTN_SECONDARY_SM} mt-2 gap-1`}>
              <Plus className="h-3 w-3" aria-hidden="true" />
              {group.type === 'INCOME' ? t.categoryManagerNewIncome : t.categoryManagerNewExpense}
            </button>
          )}
        </section>
      ))}

      <CategoryFormDialog open={!!form} onClose={() => setForm(null)} householdId={householdId} category={form?.category ?? null}
        defaultType={form?.type ?? 'EXPENSE'} categories={categories} />
      {mergeAvailable && <CategoryMergeDialog open={!!mergeSource} onClose={() => setMergeSource(null)} source={mergeSource} categories={categories} />}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => { if (!deleteMutation.isPending) setDeleting(null); }}
        onConfirm={() => void confirmDelete()}
        title={t.categoryManagerDeleteTitle}
        message={fillTemplate(t.categoryManagerDeleteMessage, { name: deleting?.name ?? '' })}
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};

export default CategoryManager;
