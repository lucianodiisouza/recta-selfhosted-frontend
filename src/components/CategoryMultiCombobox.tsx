import { MultiSelect } from './ui';
import { useI18n } from '../context/I18nContext';
import { TransactionType } from '../lib/enums';
import { summarizeCategories } from '../utils/categoryFilter';
import { useCategoryOptions } from './CategoryCombobox';

interface CategoryMultiComboboxProps {
  /** Chosen categoryNames (enum or "CUSTOM:uuid"). Empty = all. */
  values: string[];
  onValuesChange: (values: string[]) => void;
  type?: TransactionType;
  disabled?: boolean;
  /** When provided, fetches and shows custom categories for that household. */
  householdId?: string;
}

/** Category filter with several categories at once (fdbk #123). "All" clears the selection. */
const CategoryMultiCombobox = ({ values, onValuesChange, type, disabled = false, householdId }: CategoryMultiComboboxProps) => {
  const { t } = useI18n();
  const { options, labelOf } = useCategoryOptions({ type, householdId, keep: values });
  const summary = summarizeCategories(values, labelOf, {
    all: t.all,
    categoryAndMore: t.categoryAndMore,
    categoriesCount: t.categoriesCount,
  });

  return (
    <MultiSelect
      values={values}
      onChange={onValuesChange}
      options={options}
      summary={summary}
      allLabel={t.all}
      searchable
      disabled={disabled}
      aria-label={t.category}
      className="h-10"
    />
  );
};

export default CategoryMultiCombobox;
