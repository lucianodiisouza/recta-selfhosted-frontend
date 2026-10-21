import { useForm } from 'react-hook-form';
import { useCurrencyMask } from '../../../hooks/useCurrencyMask';
import { useI18n } from '../../../context/I18nContext';
import { formatCurrency } from '../../../utils/format';
import { parseCurrencyValue } from '../../../utils/currency';
import SelectCombobox from '../../SelectCombobox';
import { OnboardingBudgetFormData } from '../../../schemas';
import { Budget } from '../../../types';

interface OnboardingStep7BudgetsProps {
  budgetForm: ReturnType<typeof useForm<OnboardingBudgetFormData>>;
  budgetCurrencyMask: ReturnType<typeof useCurrencyMask>;
  baseCurrency: string;
  isTransitioning: boolean;
  stepHeadingRef: React.RefObject<HTMLHeadingElement>;
  onSubmit: (data: OnboardingBudgetFormData) => void;
  hasExistingBudgets: boolean;
  budgets: Budget[];
  onboardingCategoryOptions: Array<{ value: string; label: string }>;
}

export const OnboardingStep7Budgets = ({
  budgetForm,
  budgetCurrencyMask,
  baseCurrency,
  isTransitioning,
  stepHeadingRef,
  onSubmit,
  hasExistingBudgets,
  budgets,
  onboardingCategoryOptions,
}: OnboardingStep7BudgetsProps) => {
  const { t } = useI18n();

  return (
    <form onSubmit={budgetForm.handleSubmit(onSubmit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
      <div className="animate-fade-in-up">
        <h3 
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-content mb-2 focus:outline-none"
        >
          {t.onboardingStep7Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep7Description}
        </p>
        
        {/* Mostrar orçamentos existentes */}
        {hasExistingBudgets && (
          <div className="mb-6 p-4 bg-info/10 border border-info/25 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
              {t.youAlreadyHaveBudgets}
            </p>
            <div className="space-y-2">
              {budgets && budgets.slice(0, 5).map((budget) => (
                <div key={budget.id} className="flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-medium">{budget.category}</span>
                  <span className="text-blue-600 dark:text-blue-300">
                    {formatCurrency(budget.amount, baseCurrency)}
                  </span>
                </div>
              ))}
              {budgets && budgets.length > 5 && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  {t.andMoreBudgets.replace('{{count}}', String(budgets.length - 5))}
                </p>
              )}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              {t.youCanAddMoreBudgets}
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="animate-fade-in-up animate-delay-200">
            <label htmlFor="category" className="block text-sm font-medium text-content-secondary mb-2">
              {t.categoryLabel}
            </label>
            <SelectCombobox
              value={budgetForm.watch('category') || ''}
              onValueChange={(value) => budgetForm.setValue('category', value, { shouldValidate: true })}
              options={onboardingCategoryOptions}
              placeholder={t.selectCategory}
              searchable={true}
            />
            {budgetForm.formState.errors.category && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {budgetForm.formState.errors.category.message}
              </p>
            )}
          </div>
          
          <div className="animate-fade-in-up animate-delay-300">
            <label htmlFor="budgetAmount" className="block text-sm font-medium text-content-secondary mb-2">
              {t.budgetAmountLabel}
            </label>
            <input
              id="budgetAmount"
              type="text"
              value={budgetCurrencyMask.value}
              onChange={(e) => {
                budgetCurrencyMask.onChange(e);
                const numericValue = parseCurrencyValue(e.target.value);
                budgetForm.setValue('amount', numericValue, { shouldValidate: true });
              }}
              placeholder="0,00"
              className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                budgetForm.formState.errors.amount ? 'border-negative/60' : 'border-line'
              }`}
            />
            <input
              type="hidden"
              {...budgetForm.register('amount', { valueAsNumber: true })}
            />
            {budgetForm.formState.errors.amount && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {budgetForm.formState.errors.amount.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </form>
  );
};
