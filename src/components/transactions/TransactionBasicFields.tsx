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
  /** Trava só o valor (ex.: transferência existente, cujo valor não se edita). */
  amountLocked?: boolean;
  householdId?: string;
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
  amountLocked = false,
  householdId,
}: TransactionBasicFieldsProps) => {
  const amountDisabled = disabled || amountLocked;
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const selectedAccountId = watch('accountId');
  const transactionAmount = watch('amount') || 0;
  const paid = watch('paid');

  return (
    <>
      <div>
        <label htmlFor="transaction-amount" className="sr-only">
          {t.amount}
        </label>
        <input
          id="transaction-amount"
          type="text"
          // The amount is what people type first, like the app's capture sheet.
          autoFocus={!amountDisabled}
          inputMode="decimal"
          aria-invalid={errors.amount ? true : undefined}
          value={currencyMask.value}
          onChange={(e) => {
            if (!amountDisabled) {
              currencyMask.onChange(e);
              const numericValue = parseCurrencyValue(e.target.value);
              setValue('amount', numericValue, { shouldValidate: true });
            }
          }}
          placeholder={t.currencyPlaceholder}
          disabled={amountDisabled}
          readOnly={amountDisabled}
          className={`block w-full rounded-xl border-0 bg-surface-sunken px-4 py-5 text-center font-rounded text-4xl sm:text-[44px] font-bold tabular-nums text-content placeholder:text-content-tertiary focus:outline-none focus:ring-4 ${
            errors.amount ? 'ring-2 ring-negative/60 focus:ring-negative/15' : 'focus:ring-brand/15'
          } ${amountDisabled ? 'text-content-tertiary cursor-not-allowed' : ''}`}
        />
        <input
          type="hidden"
          {...register('amount', {
            valueAsNumber: true,
          })}
        />
        {errors.amount && (
          <p className="mt-1.5 text-center text-sm text-negative">{errors.amount.message}</p>
        )}
        {(() => {
          if (transactionType === TransactionType.TRANSFER) {
            const fromAccountId = watch('fromAccountId');
            const fromAccount = accounts.find(a => a.id === fromAccountId);
            if (fromAccount) {
              const availableBalance = getAvailableBalance(fromAccount);
              return (
                <p className="mt-1.5 text-center text-xs text-content-tertiary">
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
                <p className={`mt-1.5 text-center text-xs ${isOverBalance ? 'text-negative font-medium' : 'text-content-tertiary'}`}>
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

      {transactionType !== TransactionType.TRANSFER && (
        <div>
          <label className="field-label">
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
            <p className="mt-1 text-sm text-negative">{errors.category.message}</p>
          )}
        </div>
      )}

      <div>
        <label className="field-label">
          {t.description}
        </label>
        <input
          type="text"
          {...register('description')}
          disabled={disabled}
          readOnly={disabled}
          aria-invalid={errors.description ? true : undefined}
          className="field-control"
        />
        {errors.description && (
          <p className="mt-1 text-sm text-negative">{errors.description.message}</p>
        )}
      </div>

      <div className="min-w-0">
        <label className="field-label">
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
          className={errors.date ? 'border-negative/60' : ''}
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
          <p className="mt-1 text-sm text-negative">{errors.date.message}</p>
        )}
      </div>

      {transactionType !== TransactionType.TRANSFER && (
        <label className={`flex items-center justify-between gap-4 rounded-xl bg-surface-sunken/70 px-4 py-3 ${disabled ? 'opacity-60' : 'cursor-pointer'}`}>
          <span className="min-w-0">
            <span className="block text-[15px] font-medium text-content">{t.paid}</span>
            <span className="block text-xs text-content-tertiary">{t.paidDescription}</span>
          </span>
          <input
            type="checkbox"
            {...register('paid')}
            disabled={disabled}
            className="switch-input"
          />
        </label>
      )}
    </>
  );
};
