import { Controller, UseFormRegister, UseFormWatch, UseFormSetValue, Control, FieldErrors } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { useCurrency } from '../../context/CurrencyContext';
import type { UseCurrencyMaskReturn } from '../../hooks/useCurrencyMask';
import { TransactionFormData } from '../../schemas';
import { TransactionType, AccountType } from '../../lib/enums';
import { formatCurrency } from '../../utils/format';
import { parseCurrencyValue } from '../../utils/currency';
import { getAvailableBalance } from '../../utils/accountBalance';
import CategoryCombobox from '../CategoryCombobox';
import { DatePicker } from '../DatePicker';
import type { Account } from '../../types';

interface TransactionBasicFieldsProps {
  control: Control<TransactionFormData>;
  register: UseFormRegister<TransactionFormData>;
  watch: UseFormWatch<TransactionFormData>;
  setValue: UseFormSetValue<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  transactionType: TransactionType;
  accounts: Account[];
  currencyMask: UseCurrencyMaskReturn;
  isCreditCardContext?: boolean;
  disabled?: boolean;
  householdId?: string;
  /** A note under the amount (e.g. that the value will be used by the next occurrences of a recurrence). */
  amountHint?: string | null;
}

export const TransactionBasicFields = ({
  control,
  register,
  watch,
  setValue,
  errors,
  transactionType,
  accounts,
  currencyMask,
  isCreditCardContext = false,
  disabled = false,
  householdId,
  amountHint = null,
}: TransactionBasicFieldsProps) => {
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const selectedAccountId = watch('accountId');
  const transactionAmount = watch('amount') || 0;
  const paid = watch('paid');

  return (
    <>
      {transactionType !== TransactionType.TRANSFER && (
        <div>
          <label className="block text-sm font-light text-gray-500 dark:text-gray-400 mb-2">
            {t.category}
          </label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => {
              const transactionTypeValue = watch('type');
              const categoryType = isCreditCardContext 
                ? TransactionType.EXPENSE
                : transactionTypeValue === TransactionType.INCOME 
                  ? TransactionType.INCOME
                  : transactionTypeValue === TransactionType.EXPENSE 
                    ? TransactionType.EXPENSE
                    : undefined;
              
              return (
                <CategoryCombobox
                  value={field.value || ''}
                  onValueChange={(value: string) => field.onChange(value)}
                  placeholder={t.category}
                  type={categoryType}
                  disabled={disabled}
                  householdId={householdId}
                />
              );
            }}
          />
          {errors.category && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.category.message}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.amount}
        </label>
        <input
          type="text"
          value={currencyMask.value}
          onChange={(e) => {
            if (!disabled) {
              currencyMask.onChange(e);
              const numericValue = parseCurrencyValue(e.target.value);
              setValue('amount', numericValue, { shouldValidate: true });
            }
          }}
          placeholder={t.currencyPlaceholder}
          disabled={disabled}
          readOnly={disabled}
          className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
            errors.amount ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
          } ${disabled ? 'bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
        />
        <input
          type="hidden"
          {...register('amount', {
            valueAsNumber: true,
          })}
        />
        {errors.amount && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount.message}</p>
        )}
        {amountHint && !disabled && (
          <p id="transaction-amount-hint" className="mt-1 text-xs font-light text-blue-700 dark:text-blue-300">{amountHint}</p>
        )}
        {(() => {
          if (transactionType === TransactionType.TRANSFER) {
            const fromAccountId = watch('fromAccountId');
            const fromAccount = accounts.find(a => a.id === fromAccountId);
            if (fromAccount) {
              const availableBalance = getAvailableBalance(fromAccount);
              return (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t.availableBalance}: {formatCurrency(availableBalance, baseCurrency)}
                </p>
              );
            }
          }
          if (transactionType === TransactionType.EXPENSE && paid && selectedAccountId) {
            const selectedAccount = accounts.find(a => a.id === selectedAccountId);
            if (selectedAccount && selectedAccount.type !== AccountType.CREDIT) {
              const availableBalance = getAvailableBalance(selectedAccount);
              const isOverBalance = transactionAmount > availableBalance;
              return (
                <p className={`mt-1 text-xs ${isOverBalance ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                  {t.availableBalance}: {formatCurrency(availableBalance, baseCurrency)}
                  {isOverBalance && (
                    <span className="ml-2">({t.insufficientAvailableBalance})</span>
                  )}
                </p>
              );
            }
          }
          return null;
        })()}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.description}
        </label>
        <input
          type="text"
          {...register('description')}
          disabled={disabled}
          readOnly={disabled}
          className={`block w-full px-3 py-2.5 border rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:border-primary-500 dark:focus:border-primary-500 sm:text-sm font-light tracking-tight ${
            errors.description ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
          } ${disabled ? 'bg-gray-100 dark:bg-gray-900/50 text-gray-500 dark:text-gray-400 cursor-not-allowed' : ''}`}
        />
        {errors.description && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.description.message}</p>
        )}
      </div>

      <div className="min-w-0">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.date}
        </label>
        <DatePicker
          value={watch('date') || new Date()}
          onChange={(date) => {
            if (!disabled) {
              setValue('date', date || new Date(), { shouldValidate: true, shouldDirty: true });
            }
          }}
          placeholder={t.date}
          className={errors.date ? 'border-red-300 dark:border-red-600' : ''}
          useModal={true}
          disabled={disabled}
        />
        <input
          type="hidden"
          {...register('date', {
            valueAsDate: true,
          })}
        />
        {errors.date && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.date.message}</p>
        )}
      </div>

      {transactionType !== TransactionType.TRANSFER && (
        <div className="flex items-center">
          <input
            type="checkbox"
            {...register('paid')}
            disabled={disabled}
            className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ${disabled ? 'cursor-not-allowed opacity-60' : ''}`}
          />
          <label className="ml-2 block text-sm text-gray-900 dark:text-gray-100">
            {t.paid}
          </label>
          <p className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            ({t.paidDescription})
          </p>
        </div>
      )}
    </>
  );
};
