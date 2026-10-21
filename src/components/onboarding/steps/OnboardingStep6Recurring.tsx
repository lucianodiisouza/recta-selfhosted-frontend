import { useForm } from 'react-hook-form';
import { useCurrencyMask } from '../../../hooks/useCurrencyMask';
import { useI18n } from '../../../context/I18nContext';
import { formatCurrency } from '../../../utils/format';
import { parseCurrencyValue } from '../../../utils/currency';
import { Account, RecurringTransaction } from '../../../types';
import SelectCombobox from '../../SelectCombobox';
import { OnboardingRecurringFormData } from '../../../schemas';

interface OnboardingStep6RecurringProps {
  recurringForm: ReturnType<typeof useForm<OnboardingRecurringFormData>>;
  recurringCurrencyMask: ReturnType<typeof useCurrencyMask>;
  bankAccountsForRecurring: Account[];
  baseCurrency: string;
  isTransitioning: boolean;
  stepHeadingRef: React.RefObject<HTMLHeadingElement>;
  onSubmit: (data: OnboardingRecurringFormData) => void;
  recurringAccountId: string;
  onRecurringAccountIdChange: (accountId: string) => void;
  hasExistingRecurring: boolean;
  recurringTransactions: RecurringTransaction[];
  getFrequencyLabel: (frequency: string) => string;
}

export const OnboardingStep6Recurring = ({
  recurringForm,
  recurringCurrencyMask,
  bankAccountsForRecurring,
  baseCurrency,
  isTransitioning,
  stepHeadingRef,
  onSubmit,
  recurringAccountId,
  onRecurringAccountIdChange,
  hasExistingRecurring,
  recurringTransactions,
  getFrequencyLabel,
}: OnboardingStep6RecurringProps) => {
  const { t } = useI18n();

  return (
    <form onSubmit={recurringForm.handleSubmit(onSubmit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
      <div className="animate-fade-in-up">
        <h3 
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-content mb-2 focus:outline-none"
        >
          {t.onboardingStep6Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep6Description}
        </p>
        
        {/* Aviso quando não há contas bancárias */}
        {(!bankAccountsForRecurring || bankAccountsForRecurring.length === 0) && !hasExistingRecurring && (
          <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">
              {t.noAccountsForRecurring || 'Nenhuma conta bancária disponível'}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300">
              {t.noAccountsForRecurringHint || 'Você pode pular este passo e criar recorrências depois no app. Cartões de crédito e investimentos não aceitam recorrências.'}
            </p>
          </div>
        )}

        {/* Mostrar recorrências existentes */}
        {hasExistingRecurring && (
          <div className="mb-6 p-4 bg-info/10 border border-info/25 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
              {t.youAlreadyHaveRecurring}
            </p>
            <div className="space-y-2">
              {recurringTransactions && recurringTransactions.slice(0, 5).map((recurring) => (
                <div key={recurring.id} className="flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-medium">{recurring.description}</span>
                  <span className="text-blue-600 dark:text-blue-300">
                    {formatCurrency(recurring.amount, baseCurrency)} • {getFrequencyLabel(recurring.frequency)}
                  </span>
                </div>
              ))}
              {recurringTransactions && recurringTransactions.length > 5 && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-2">
                  {t.andMoreRecurring.replace('{{count}}', String(recurringTransactions.length - 5))}
                </p>
              )}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              {t.youCanAddMoreRecurring}
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="animate-fade-in-up animate-delay-200">
            <label htmlFor="description" className="block text-sm font-medium text-content-secondary mb-2">
              {t.descriptionLabel}
            </label>
            <input
              id="description"
              type="text"
              {...recurringForm.register('description')}
              placeholder={t.descriptionPlaceholder}
              className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                recurringForm.formState.errors.description ? 'border-negative/60' : 'border-line'
              }`}
            />
            {recurringForm.formState.errors.description && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {recurringForm.formState.errors.description.message}
              </p>
            )}
          </div>

          <div className="animate-fade-in-up animate-delay-300">
            <label htmlFor="amount" className="block text-sm font-medium text-content-secondary mb-2">
              {t.amountLabel}
            </label>
            <input
              id="amount"
              type="text"
              value={recurringCurrencyMask.value}
              onChange={(e) => {
                recurringCurrencyMask.onChange(e);
                const numericValue = parseCurrencyValue(e.target.value);
                recurringForm.setValue('amount', numericValue, { shouldValidate: true });
              }}
              placeholder="0,00"
              className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                recurringForm.formState.errors.amount ? 'border-negative/60' : 'border-line'
              }`}
            />
            <input
              type="hidden"
              {...recurringForm.register('amount', { valueAsNumber: true })}
            />
            {recurringForm.formState.errors.amount && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {recurringForm.formState.errors.amount.message}
              </p>
            )}
          </div>
          
          {bankAccountsForRecurring && bankAccountsForRecurring.length > 0 && (
            <div className="animate-fade-in-up animate-delay-400">
              <label id="account-select-label" className="block text-sm font-medium text-content-secondary mb-2">
                {t.accountOptionalLabel}
              </label>
              <SelectCombobox
                value={recurringAccountId}
                onValueChange={(value) => {
                  onRecurringAccountIdChange(value);
                  recurringForm.setValue('accountId', value || undefined);
                }}
                options={[
                  { value: '', label: t.none },
                  ...bankAccountsForRecurring.map(account => ({ value: account.id || '', label: account.name }))
                ]}
                placeholder={t.selectAccount}
                searchable={false}
              />
            </div>
          )}
        </div>
      </div>
    </form>
  );
};
