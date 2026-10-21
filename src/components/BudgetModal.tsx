import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransactions } from '../context/TransactionsContext';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { parseCurrencyValue } from '../utils/currency';
import { Budget } from '../types';
import { startOfMonth } from 'date-fns';
import { createSchemas, BudgetFormData } from '../schemas';
import SelectCombobox from './SelectCombobox';
import { getMergedCategories } from '../utils/categories';
import { toCategoryName, TransactionType, CustomCategoryInfo as EnumCustomCategoryInfo, CategoryType } from '../lib/enums';
import { DatePicker } from './DatePicker';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingBudget: Budget | null;
  selectedMonth: Date;
}

export const BudgetModal = ({
  isOpen,
  onClose,
  editingBudget,
  selectedMonth,
}: BudgetModalProps) => {
  const { addBudget, updateBudget, customCategories } = useTransactions();
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();
  const currencyMask = useCurrencyMask();
  const { budgetSchema } = createSchemas(t);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    control,
    setValue,
  } = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: {
      category: '',
      amount: 0,
      type: TransactionType.EXPENSE,
      month: new Date(),
    },
  });

  const watchedType = useWatch({ control, name: 'type' });
  const watchedCategory = useWatch({ control, name: 'category' });
  const watchedMonth = useWatch({ control, name: 'month' });

  const typeOptions = useMemo(() => [
    { value: TransactionType.INCOME, label: t.income },
    { value: TransactionType.EXPENSE, label: t.expense },
  ], [t]);

  const categoryOptions = useMemo(() => {
    const categoryType: CategoryType | undefined =
      watchedType === TransactionType.INCOME
        ? CategoryType.INCOME
        : watchedType === TransactionType.EXPENSE
          ? CategoryType.EXPENSE
          : undefined;
    const merged = getMergedCategories(
      categoryType,
      (customCategories || []) as EnumCustomCategoryInfo[],
      t as unknown as Record<string, string>
    );
    return [
      // Special pseudo-category. Stored as the literal "GENERAL" so the backend
      // can recognize it without us having to map to OTHER_EXPENSES.
      { value: 'GENERAL', label: t.general },
      ...merged.map((x) => ({ value: x.value, label: x.display })),
    ];
  }, [watchedType, customCategories, t]);

  useEffect(() => {
    if (editingBudget) {
      const budgetAmount = editingBudget.amount || 0;
      const budgetMonth = editingBudget.month instanceof Date 
        ? editingBudget.month 
        : new Date(editingBudget.month);
      const resolvedCategory =
        editingBudget.categoryName ??
        (editingBudget.category && toCategoryName(
          editingBudget.category,
          t as unknown as Record<string, string>,
          (customCategories || []) as EnumCustomCategoryInfo[]
        )) ??
        editingBudget.category;

      reset({
        category: resolvedCategory,
        amount: budgetAmount,
        type: editingBudget.type,
        month: budgetMonth,
      });

      currencyMask.setValue(budgetAmount);
      setValue('amount', budgetAmount, { shouldValidate: false });
    } else {
      reset({
        category: '',
        amount: 0,
        type: TransactionType.EXPENSE,
        month: selectedMonth,
      });
      currencyMask.setValue('');
      setValue('amount', 0, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingBudget?.id, selectedMonth.getTime(), reset, setValue]);

  // Clear category when it's not valid for the selected type (e.g. switched from expense to income)
  useEffect(() => {
    if (!isOpen) return;
    const categoryType: CategoryType | undefined =
      watchedType === TransactionType.INCOME
        ? CategoryType.INCOME
        : watchedType === TransactionType.EXPENSE
          ? CategoryType.EXPENSE
          : undefined;
    const merged = getMergedCategories(
      categoryType,
      (customCategories || []) as EnumCustomCategoryInfo[],
      t as unknown as Record<string, string>
    );
    const validValues = ['GENERAL', ...merged.map((x) => x.value)];
    if (watchedCategory && !validValues.includes(watchedCategory)) {
      setValue('category', '');
    }
  }, [isOpen, watchedType, watchedCategory, customCategories, t, setValue]);

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isOpen) return;
    
    // Prevenir scroll do body quando modal estiver aberto
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const onSubmit = async (data: BudgetFormData) => {
    try {
      const budgetData: Omit<Budget, 'id' | 'userId'> = {
        category: data.category.trim(),
        amount: data.amount,
        type: data.type,
        month: data.month,
      };

      if (editingBudget?.id) {
        await updateBudget(editingBudget.id, budgetData);
        success(t.budgetUpdated);
      } else {
        await addBudget(budgetData);
        success(t.budgetCreated);
      }
      onClose();
      currencyMask.setValue('');
    } catch (err: unknown) {
      // 409: a budget for this category, type and month already exists
      const status = (err as { status?: number } | null)?.status;
      const errorMsg = status === 409
        ? t.budgetAlreadyExists
        : err instanceof Error ? err.message : t.errorSavingBudget;
      showError(errorMsg);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="relative w-full sm:w-96 max-w-md p-4 sm:p-5 bg-surface-elevated max-h-[90vh] overflow-y-auto min-w-0 rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
        <div className="flex items-center justify-between mb-6 pb-6 border-b border-line-subtle">
          <h3 className="font-rounded text-lg font-semibold text-content">
            {editingBudget ? t.editBudget : t.newBudget}
          </h3>
          <button
            onClick={onClose}
            aria-label="Fechar modal"
            className="text-content-tertiary hover:opacity-70 transition-opacity p-1"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-light text-content-tertiary mb-2">
              {t.type}
            </label>
            <SelectCombobox
              value={watchedType}
              onValueChange={(value) => setValue('type', value as TransactionType, { shouldValidate: true })}
              options={typeOptions}
              placeholder={t.select}
            />
            {errors.type && (
              <p className="mt-1 text-sm text-negative">{errors.type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-light text-content-tertiary mb-2">
              {t.category}
            </label>
            <SelectCombobox
              value={watchedCategory}
              onValueChange={(value) => setValue('category', value, { shouldValidate: true })}
              options={categoryOptions}
              placeholder={t.selectCategory}
              searchable={true}
            />
            <p className="mt-1 text-xs font-light text-content-tertiary">
              {t.general} - {watchedType === TransactionType.EXPENSE ? t.totalExpense : t.totalIncome}
            </p>
            {errors.category && (
              <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-light text-content-tertiary mb-2">
              {t.amount}
            </label>
            <input
              type="text"
              value={currencyMask.value}
              onChange={(e) => {
                currencyMask.onChange(e);
                const numericValue = parseCurrencyValue(e.target.value);
                setValue('amount', numericValue, { shouldValidate: true });
              }}
              placeholder={t.currencyPlaceholder}
              className={`field-control ${
                errors.amount ? 'border-negative/60' : 'border-line-subtle'
              }`}
            />
            <input
              type="hidden"
              {...register('amount', {
                valueAsNumber: true,
              })}
            />
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>
            )}
          </div>

          <div className="min-w-0">
            <label className="block text-sm font-light text-content-tertiary mb-2">
              {t.month}
            </label>
            <DatePicker
              value={watchedMonth || new Date()}
              onChange={(date) => {
                if (date) {
                  // Always use the first day of the selected month
                  const monthDate = startOfMonth(date);
                  setValue('month', monthDate, { 
                    shouldValidate: true, 
                    shouldDirty: true,
                    shouldTouch: true
                  });
                }
              }}
              placeholder={t.month}
              className={errors.month ? 'border-negative/60' : ''}
              useModal={true}
            />
            <input
              type="hidden"
              {...register('month', {
                valueAsDate: true,
              })}
            />
            {errors.month && (
              <p className="mt-1 text-sm text-red-600">{errors.month.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-6 border-t border-line-subtle">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
            >
              {isSubmitting ? t.loading : editingBudget ? t.update : t.create}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

