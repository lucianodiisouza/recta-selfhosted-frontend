import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useCurrencyMask } from '../../../hooks/useCurrencyMask';
import { useI18n } from '../../../context/I18nContext';
import { formatCurrency } from '../../../utils/format';
import { parseCurrencyValue } from '../../../utils/currency';
import { getDisplayBalance } from '../../../utils/accountBalance';
import { AccountType } from '../../../lib/enums';
import SelectCombobox from '../../SelectCombobox';
import { Switch } from '../../ui/Switch';
import { OnboardingAccountFormData } from '../../../schemas';
import { Account } from '../../../types';

interface OnboardingStep5AccountsProps {
  accountForm: ReturnType<typeof useForm<OnboardingAccountFormData>>;
  accountCurrencyMask: ReturnType<typeof useCurrencyMask>;
  creditLimitCurrencyMask: ReturnType<typeof useCurrencyMask>;
  accounts: Account[];
  baseCurrency: string;
  getAccountTypeLabel: (type: string) => string;
  hasExistingAccounts: boolean;
  isTransitioning: boolean;
  stepHeadingRef: React.RefObject<HTMLHeadingElement>;
  onSubmit: (data: OnboardingAccountFormData) => void;
}

export const OnboardingStep5Accounts = ({
  accountForm,
  accountCurrencyMask,
  creditLimitCurrencyMask,
  accounts,
  baseCurrency,
  getAccountTypeLabel,
  hasExistingAccounts,
  isTransitioning,
  stepHeadingRef,
  onSubmit,
}: OnboardingStep5AccountsProps) => {
  const { t } = useI18n();
  const watchedAccountType = accountForm.watch('accountType');
  // Conta que já começa no negativo (cheque especial, fdbk #133): mesmo interruptor do
  // formulário de conta. Cartão fica de fora (a dívida do cartão já é positiva).
  const [startsNegative, setStartsNegative] = useState(false);
  const canStartNegative = watchedAccountType !== AccountType.CREDIT;
  const signedBalance = (amount: number, negative: boolean) =>
    negative && canStartNegative ? -Math.abs(amount) : Math.abs(amount);
  useEffect(() => {
    accountForm.setValue('balance', signedBalance(parseCurrencyValue(accountCurrencyMask.value), startsNegative));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStartNegative]);
  // Cada conta adicionada recomeça com o interruptor desligado.
  useEffect(() => { setStartsNegative(false); }, [accounts.length]);

  return (
    <form onSubmit={accountForm.handleSubmit(onSubmit)} className={`space-y-6 ${isTransitioning ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'} transition-all duration-300 ease-out`}>
      <div className="animate-fade-in-up">
        <h3 
          ref={stepHeadingRef}
          tabIndex={-1}
          className="text-xl font-semibold text-content mb-2 focus:outline-none"
        >
          {t.onboardingStep5Title}
        </h3>
        <p className="text-content-secondary mb-4 animate-fade-in-up animate-delay-100">
          {t.onboardingStep5Description}
        </p>
        
        {/* Mostrar contas existentes */}
        {hasExistingAccounts && (
          <div className="mb-6 p-4 bg-info/10 border border-info/25 rounded-lg">
            <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-3">
              {t.youAlreadyHaveAccounts}
            </p>
            <div className="space-y-2">
              {accounts && accounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-medium">{account.name}</span>
                  <span className="text-blue-600 dark:text-blue-300">
                    {getAccountTypeLabel(account.type)} • {formatCurrency(getDisplayBalance(account), baseCurrency)}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              {t.youCanAddMoreAccounts}
            </p>
          </div>
        )}
        
        <div className="space-y-4">
          <div className="animate-fade-in-up animate-delay-200">
            <label htmlFor="accountName" className="block text-sm font-medium text-content-secondary mb-2">
              {t.accountNameLabel}
            </label>
            <input
              id="accountName"
              type="text"
              {...accountForm.register('accountName')}
              placeholder={t.accountNamePlaceholder}
              className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                accountForm.formState.errors.accountName ? 'border-negative/60' : 'border-line'
              }`}
            />
            {accountForm.formState.errors.accountName && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {accountForm.formState.errors.accountName.message}
              </p>
            )}
          </div>

          <div className="animate-fade-in-up animate-delay-300">
            <label id="account-type-label" className="block text-sm font-medium text-content-secondary mb-2">
              {t.accountTypeLabel}
            </label>
            <SelectCombobox
              value={watchedAccountType}
              onValueChange={(value) => accountForm.setValue('accountType', value as AccountType, { shouldValidate: true })}
              options={[
                { value: AccountType.CHECKING, label: getAccountTypeLabel(AccountType.CHECKING) },
                { value: AccountType.SAVINGS, label: getAccountTypeLabel(AccountType.SAVINGS) },
                { value: AccountType.CREDIT, label: getAccountTypeLabel(AccountType.CREDIT) },
                { value: AccountType.CASH, label: getAccountTypeLabel(AccountType.CASH) },
                { value: AccountType.INVESTMENT, label: getAccountTypeLabel(AccountType.INVESTMENT) },
              ]}
              placeholder={t.selectAccountType}
              searchable={false}
            />
          </div>
          
          <div className="animate-fade-in-up animate-delay-400">
            <label htmlFor="balance" className="block text-sm font-medium text-content-secondary mb-2">
              {watchedAccountType === 'CREDIT' ? t.initialDebt : t.initialBalance}
            </label>
            <input
              id="balance"
              type="text"
              value={accountCurrencyMask.value}
              onChange={(e) => {
                accountCurrencyMask.onChange(e);
                const numericValue = parseCurrencyValue(e.target.value);
                accountForm.setValue('balance', signedBalance(numericValue, startsNegative), { shouldValidate: true });
              }}
              placeholder="0,00"
              className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                accountForm.formState.errors.balance ? 'border-negative/60' : 'border-line'
              }`}
            />
            <input
              type="hidden"
              {...accountForm.register('balance', { valueAsNumber: true })}
            />
            {watchedAccountType === 'CREDIT' && (
              <p className="mt-2 text-xs text-gray-500">
                {t.creditCardInitialDebtHint}
              </p>
            )}
            {canStartNegative && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-content">{t.startsNegative}</p>
                  <p className="text-xs text-content-tertiary">{t.startsNegativeHint}</p>
                </div>
                <Switch
                  checked={startsNegative}
                  label={t.startsNegative}
                  onChange={(on) => {
                    setStartsNegative(on);
                    accountForm.setValue('balance', signedBalance(parseCurrencyValue(accountCurrencyMask.value), on), { shouldValidate: true });
                  }}
                />
              </div>
            )}
            {accountForm.formState.errors.balance && (
              <p className="mt-2 text-sm text-negative" role="alert">
                {accountForm.formState.errors.balance.message}
              </p>
            )}
          </div>

          {watchedAccountType === 'CREDIT' && (
            <>
              <div className="animate-fade-in-up animate-delay-500">
                <label htmlFor="creditLimit" className="block text-sm font-medium text-content-secondary mb-2">
                  {t.cardLimit}
                </label>
                <input
                  id="creditLimit"
                  type="text"
                  value={creditLimitCurrencyMask.value}
                  onChange={(e) => {
                    creditLimitCurrencyMask.onChange(e);
                    const numericValue = parseCurrencyValue(e.target.value);
                    accountForm.setValue('creditLimit', numericValue > 0 ? numericValue : undefined, { shouldValidate: true });
                  }}
                  placeholder="0,00"
                  className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                    accountForm.formState.errors.creditLimit ? 'border-negative/60' : 'border-line'
                  }`}
                />
                <input
                  type="hidden"
                  {...accountForm.register('creditLimit', { valueAsNumber: true })}
                />
                {accountForm.formState.errors.creditLimit && (
                  <p className="mt-2 text-sm text-negative" role="alert">
                    {accountForm.formState.errors.creditLimit.message}
                  </p>
                )}
              </div>

              <div className="animate-fade-in-up animate-delay-500">
                <label htmlFor="dueDay" className="block text-sm font-medium text-content-secondary mb-2">
                  {t.dueDay}
                </label>
                <input
                  id="dueDay"
                  type="number"
                  min="1"
                  max="31"
                  {...accountForm.register('dueDay', { valueAsNumber: true })}
                  placeholder={t.exampleDay}
                  className={`block w-full px-4 py-3 border rounded-lg shadow-sm bg-surface-elevated text-content focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all duration-200 hover:shadow-md ${
                    accountForm.formState.errors.dueDay ? 'border-negative/60' : 'border-line'
                  }`}
                />
                <p className="mt-2 text-xs text-gray-500">
                  {t.dayOfMonth}
                </p>
                {accountForm.formState.errors.dueDay && (
                  <p className="mt-2 text-sm text-negative" role="alert">
                    {accountForm.formState.errors.dueDay.message}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </form>
  );
};
