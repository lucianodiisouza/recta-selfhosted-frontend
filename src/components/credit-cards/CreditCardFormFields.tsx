import { useI18n } from '../../context/I18nContext';
import { parseCurrencyValue } from '../../utils/currency';
import { useClosingDayAutoFill } from '../../hooks/useClosingDayAutoFill';
import type { UseFormReturn, UseFormSetValue } from 'react-hook-form';

interface CreditCardFormFieldsProps {
  form: UseFormReturn<any>;
  creditLimitMask: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  balanceMask?: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  // Loose type so the parent can pass either a strict UseFormSetValue or a relaxed
  // string-based setValue without a type error.
  setValue: UseFormSetValue<any> | ((name: string, value: any, options?: any) => void);
  isCreation: boolean;
}

export const CreditCardFormFields = ({
  form,
  creditLimitMask,
  balanceMask,
  setValue,
  isCreation,
}: CreditCardFormFieldsProps) => {
  const { t } = useI18n();
  const { register, formState: { errors } } = form;
  // The closing day follows the due day (due - 7) until the user types their own
  const suggestedClosing = useClosingDayAutoFill(form);

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.accountName || 'Nome do Cartão'}
        </label>
        <input
          type="text"
          {...register('name')}
          className={`block w-full px-3 py-2 border rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            errors.name ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
          }`}
          placeholder={t.accountNamePlaceholder || 'Ex: Nubank, Inter...'}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{(errors.name as { message?: string }).message ?? ''}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.cardLimit}
        </label>
        <input
          type="text"
          value={creditLimitMask.value}
          onChange={(e) => {
            creditLimitMask.onChange(e);
            const numericValue = parseCurrencyValue(e.target.value);
            setValue('creditLimit', numericValue, { shouldValidate: true });
          }}
          placeholder={t.currencyPlaceholder || '0,00'}
          className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            errors.creditLimit ? 'border-red-300 dark:border-red-600' : ''
          }`}
        />
        <input
          type="hidden"
          {...register('creditLimit', { valueAsNumber: true })}
        />
        {errors.creditLimit && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors.creditLimit as { message?: string }).message ?? ''}</p>
        )}
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.dueDay}
        </label>
        <input
          type="number"
          {...register('dueDay', { valueAsNumber: true })}
          className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            errors.dueDay ? 'border-red-300 dark:border-red-600' : ''
          }`}
          placeholder="1-31"
          min="1"
          max="31"
        />
        {errors.dueDay && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors.dueDay as { message?: string }).message ?? ''}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.closingDay}
        </label>
        <input
          type="number"
          {...register('closingDay', { valueAsNumber: true })}
          className={`block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm ${
            errors.closingDay ? 'border-red-300 dark:border-red-600' : ''
          }`}
          placeholder={suggestedClosing ? String(suggestedClosing) : '1-31'}
          min="1"
          max="31"
        />
        <p className="mt-1 text-xs font-light text-gray-400 dark:text-gray-500">
          {t.closingDayFromDueHint}
        </p>
        {errors.closingDay && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors.closingDay as { message?: string }).message ?? ''}</p>
        )}
      </div>

      {/* Dívida inicial só aparece na criação, não na edição */}
      {isCreation && balanceMask && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.initialDebt}
          </label>
          <input
            type="text"
            value={balanceMask.value}
            onChange={(e) => {
              balanceMask.onChange(e);
              const numericValue = parseCurrencyValue(e.target.value);
              setValue('balance', numericValue, { shouldValidate: true });
            }}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder={t.currencyPlaceholder || '0,00'}
          />
          <input
            type="hidden"
            {...register('balance', { valueAsNumber: true })}
          />
          {errors.balance && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{(errors.balance as { message?: string }).message ?? ''}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          {t.color}
        </label>
        <input
          type="color"
          {...register('color')}
          className="block w-full h-10 p-1 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
        />
      </div>
    </>
  );
};
