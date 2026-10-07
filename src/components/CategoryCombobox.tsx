import * as Popover from '@radix-ui/react-popover';
import { useState, useMemo, useCallback, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { ChevronDown, Check, Search, Plus } from 'lucide-react';
import { useI18n } from '../context/I18nContext';
import { CategoryType, getCategoryDisplayName, TransactionType } from '../lib/enums';
import { getMergedCategories, type MergedCategoryOption } from '../utils/categories';
import { useCategories, useCreateCategory } from '../hooks/api/useCategories';
import { createOptionFor, customValue } from '../utils/categoryManager';
import { failureText } from './categories/categoryText';
import { fillTemplate } from '../utils/fillTemplate';

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
  /**
   * Offers “Create <text>” when the typed text matches no category: it creates a custom category of the form's type
   * (needs `type`) and selects it. Off for filters.
   */
  allowCreate?: boolean;
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
  allowCreate = false,
}: CategoryComboboxProps) => {
  const { t, locale } = useI18n();
  const defaultPlaceholder = placeholder || t.selectCategory;
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const apiType = type === TransactionType.INCOME ? CategoryType.INCOME : type === TransactionType.EXPENSE ? CategoryType.EXPENSE : undefined;
  const { data: categoriesData = [] } = useCategories({ householdId, type: apiType });
  const createMutation = useCreateCategory();
  // Categories created here: shown by name at once, before the list refetch brings them (no raw CUSTOM:uuid on screen).
  const [created, setCreated] = useState<Array<{ id: string; name: string; type: CategoryType; color?: string | null; icon?: string | null }>>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const creatingRef = useRef(false);
  const custom = useMemo(() => {
    const fromApi = categoriesData
      .filter((c) => !c.isSystem)
      .map((c) => ({ id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon }));
    return [...fromApi, ...created.filter((c) => !fromApi.some((x) => x.id === c.id) && (!apiType || c.type === apiType))];
  }, [categoriesData, created, apiType]);

  const getAllLabel = useCallback(() => {
    if (allOptionLabel) return allOptionLabel;
    if (locale === 'pt-BR') return 'Todas';
    return t.all;
  }, [allOptionLabel, locale, t]);

  const allOption: MergedCategoryOption | null = useMemo(
    () => showAllOption ? { value: '', display: getAllLabel() } : null,
    [showAllOption, getAllLabel]
  );
  const baseOptions = useMemo(() => getMergedCategories(apiType, custom, t as unknown as Record<string, string>), [apiType, custom, t]);

  const filteredOptions = useMemo(() => {
    let list = baseOptions;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter((o) => o.display.toLowerCase().includes(lower));
    }
    list = [...list].sort((a, b) => a.display.localeCompare(b.display, locale, { sensitivity: 'base' }));
    if (allOption && (!searchTerm || allOption.display.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return [allOption, ...list];
    }
    return list;
  }, [baseOptions, searchTerm, allOption, locale]);

  const displayValue = value
    ? getCategoryDisplayName(value, t as unknown as Record<string, string>, custom)
    : showAllOption
      ? getAllLabel()
      : defaultPlaceholder;

  const createOption = useMemo(
    () => (allowCreate && apiType ? createOptionFor(searchTerm, baseOptions) : null),
    [allowCreate, apiType, searchTerm, baseOptions]
  );

  const handleCreate = async () => {
    if (!createOption || !apiType || creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    setCreateError(null);
    try {
      const made = await createMutation.mutateAsync({ householdId, name: createOption.name, type: apiType });
      setCreated((prev) => [...prev, { id: made.id, name: made.name, type: made.type, color: made.color, icon: made.icon }]);
      onValueChange(customValue(made.id));
      setOpen(false);
      setSearchTerm('');
    } catch (err: unknown) {
      setCreateError(failureText(t, err));
    } finally {
      creatingRef.current = false;
      setCreating(false);
    }
  };

  const handleSelect = (optionValue: string) => {
    onValueChange(optionValue);
    setOpen(false);
    setSearchTerm('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && filteredOptions.length > 0) {
      e.preventDefault();
      handleSelect(filteredOptions[0].value);
    } else if (e.key === 'Enter' && createOption) {
      e.preventDefault();
      void handleCreate();
    } else if (e.key === 'Escape') {
      setOpen(false);
      setSearchTerm('');
    }
  };

  return (
    <Popover.Root open={disabled ? false : open} onOpenChange={disabled ? undefined : setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={`inline-flex items-center justify-between w-full h-10 px-3 text-sm leading-none border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 data-[placeholder]:text-gray-500 dark:data-[placeholder]:text-gray-400 ${
            disabled
              ? 'bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed border-gray-200 dark:border-gray-700'
              : 'hover:bg-gray-50 dark:hover:bg-gray-600'
          }`}
        >
          <span className={value ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}>
            {displayValue}
          </span>
          <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400 ml-2 flex-shrink-0" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="w-[var(--radix-popover-trigger-width)] bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-gray-700 z-[100] p-1 max-h-[300px] overflow-hidden flex flex-col"
          sideOffset={4}
        >
          <div className="relative px-2 py-1.5 border-b border-gray-200 dark:border-gray-700">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => { setSearchTerm(e.target.value); setCreateError(null); }}
              onKeyDown={handleKeyDown}
              placeholder={t.searchCategory}
              className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
                {t.noCategoryFound}
              </div>
            ) : (
              <div className="py-1">
                {filteredOptions.map((opt, index) => {
                  const isAll = showAllOption && opt.value === '';
                  const isSelected = isAll ? !value : value === opt.value;
                  return (
                    <button
                      key={opt.value || '__all__'}
                      type="button"
                      onClick={() => handleSelect(opt.value)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left rounded-sm hover:bg-primary-100 dark:hover:bg-primary-900/30 focus:bg-primary-100 dark:focus:bg-primary-900/30 focus:outline-none cursor-pointer ${
                        isSelected ? 'bg-primary-50 dark:bg-primary-900/20' : ''
                      } ${isAll && index === 0 ? 'border-b border-gray-200 dark:border-gray-700 mb-1 pb-2' : ''}`}
                    >
                      <span className="text-gray-900 dark:text-gray-100">{opt.display}</span>
                      {isSelected && <Check className="h-4 w-4 text-primary-600 dark:text-primary-400" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {createOption && (
            <div className="border-t border-gray-200 dark:border-gray-700 mt-1 pt-1">
              <button
                type="button"
                disabled={creating}
                onClick={() => void handleCreate()}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left rounded-sm text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 focus:bg-primary-100 dark:focus:bg-primary-900/30 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{creating ? t.categoryComboCreating : fillTemplate(t.categoryComboCreate, { name: createOption.name })}</span>
              </button>
              {createError && <p role="alert" className="px-3 pb-2 text-xs text-red-600 dark:text-red-400">{createError}</p>}
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
};

export default CategoryCombobox;
