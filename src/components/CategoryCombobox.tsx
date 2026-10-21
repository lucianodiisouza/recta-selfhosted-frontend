import { useMemo, useCallback } from 'react';
import { Select, type SelectOption } from './ui';
import { useI18n } from '../context/I18nContext';
import { CategoryType, getCategoryDisplayName, TransactionType } from '../lib/enums';
import { getMergedCategories, type MergedCategoryOption } from '../utils/categories';
import { useCategories } from '../hooks/api/useCategories';

interface CategoryComboboxProps {
  /** categoryName (enum or "CUSTOM:uuid"). Empty for "all" when showAllOption. */
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  type?: TransactionType;
  showAllOption?: boolean;
  allOptionLabel?: string;
  disabled?: boolean;
  /** When provided, fetches and shows custom categories for that household. */
  householdId?: string;
}

/**
 * Sorted category options (system + the household's custom ones) for the category pickers.
 * Values in `keep` that are missing from the list (e.g. still loading) are added with their display
 * name, so a trigger never falls back to the placeholder.
 */
export function useCategoryOptions({ type, householdId, keep = [] }: { type?: TransactionType; householdId?: string; keep?: string[] }) {
  const { t, locale } = useI18n();
  const apiType = type === TransactionType.INCOME ? CategoryType.INCOME : type === TransactionType.EXPENSE ? CategoryType.EXPENSE : undefined;
  const { data: categoriesData = [] } = useCategories({ householdId, type: apiType });
  const custom = useMemo(
    () =>
      categoriesData
        .filter((c) => !c.isSystem)
        .map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon })),
    [categoriesData]
  );
  const baseOptions = useMemo(() => getMergedCategories(apiType, custom, t as unknown as Record<string, string>), [apiType, custom, t]);
  const keepKey = keep.join(',');
  const options = useMemo<SelectOption[]>(() => {
    const sorted = [...baseOptions].sort((a, b) => a.display.localeCompare(b.display, locale, { sensitivity: 'base' }));
    const list: SelectOption[] = sorted.map((o) => ({ value: o.value, label: o.display, color: o.color }));
    for (const value of keepKey ? keepKey.split(',') : []) {
      if (value && !list.some((o) => o.value === value)) {
        list.unshift({ value, label: getCategoryDisplayName(value, t as unknown as Record<string, string>, custom) });
      }
    }
    return list;
  }, [baseOptions, locale, keepKey, t, custom]);
  const labelOf = useCallback(
    (value: string) => options.find((o) => o.value === value)?.label ?? getCategoryDisplayName(value, t as unknown as Record<string, string>, custom),
    [options, t, custom]
  );
  return { options, labelOf };
}

const CategoryCombobox = ({
  value,
  onValueChange,
  placeholder,
  type,
  showAllOption = false,
  allOptionLabel,
  disabled = false,
  householdId,
}: CategoryComboboxProps) => {
  const { t, locale } = useI18n();
  const defaultPlaceholder = placeholder || t.selectCategory;

  const getAllLabel = useCallback(() => {
    if (allOptionLabel) return allOptionLabel;
    if (locale === 'pt-BR') return 'Todas';
    return t.all;
  }, [allOptionLabel, locale, t]);

  const allOption: MergedCategoryOption | null = useMemo(
    () => showAllOption ? { value: '', display: getAllLabel() } : null,
    [showAllOption, getAllLabel]
  );
  const { options: categoryOptions } = useCategoryOptions({ type, householdId, keep: value ? [value] : [] });

  // "All" first when enabled.
  const options = useMemo<SelectOption[]>(
    () => (allOption ? [{ value: '', label: allOption.display }, ...categoryOptions] : categoryOptions),
    [allOption, categoryOptions]
  );

  return (
    <Select
      value={value}
      onChange={onValueChange}
      options={options}
      placeholder={defaultPlaceholder}
      searchable
      disabled={disabled}
      className="h-10"
    />
  );
};

export default CategoryCombobox;
