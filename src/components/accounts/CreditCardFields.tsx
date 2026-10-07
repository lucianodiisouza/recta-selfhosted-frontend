import { Controller } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { parseCurrencyValue } from '../../utils/currency';
import { closingDayFromDue } from '../../utils/closingDay';
import { useClosingDayAutoFill } from '../../hooks/useClosingDayAutoFill';
import SelectCombobox from '../SelectCombobox';
import type { AccountFormData } from '../../schemas';
import type { Account } from '../../types';
import type { UseFormReturn } from 'react-hook-form';

interface CreditCardFieldsProps {
  account: Account | null;
  form: UseFormReturn<AccountFormData>;
  creditLimitMask: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  bankAccountsForLinking: Array<{ id: string; name: string; color?: string }>;
  setValue: (name: keyof AccountFormData, value: any, options?: any) => void;
  isCreation: boolean;
}

export const CreditCardFields = ({
  account,
  form,
  creditLimitMask,
  bankAccountsForLinking,
  setValue,
  isCreation,
}: CreditCardFieldsProps) => {
  const { t } = useI18n();
  const { register, control, formState: { errors } } = form;
  // Creating: the closing day follows the due day (due - 7) until the user types their own
  const typedSuggestion = useClosingDayAutoFill(form, isCreation);
  const suggestedClosing = isCreation ? typedSuggestion : closingDayFromDue(account?.dueDay);

  // Campos específicos de cartão de crédito - só aparecem na criação
  if (isCreation) {
    return (
      <>
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
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.creditLimit.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.dueDay || 'Dia de Vencimento'}
          </label>
          <input
            type="number"
            {...register('dueDay', { valueAsNumber: true })}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder="1-31"
            min="1"
            max="31"
          />
          {errors.dueDay && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dueDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.closingDay || 'Dia de Fechamento'}
          </label>
          <input
            type="number"
            {...register('closingDay', { valueAsNumber: true })}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder={suggestedClosing ? String(suggestedClosing) : '1-31'}
            min="1"
            max="31"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t.closingDayFromDueHint}
          </p>
          {errors.closingDay && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.closingDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Conta Bancária Vinculada
          </label>
          <Controller
            name="linkedAccountId"
            control={control}
            render={({ field }) => (
              <SelectCombobox
                value={field.value || ''}
                onValueChange={(value) => {
                  field.onChange(value || undefined);
                  // Herdar cor automaticamente quando selecionar banco
                  if (value) {
                    const linkedAccount = bankAccountsForLinking.find(acc => acc.id === value);
                    if (linkedAccount?.color) {
                      setValue('color', linkedAccount.color);
                    }
                  }
                }}
                options={[
                  { value: '', label: t.none || 'Nenhuma' },
                  ...bankAccountsForLinking.map(acc => ({ 
                    value: acc.id || '', 
                    label: acc.name 
                  }))
                ]}
                placeholder={t.selectAccount || 'Selecione uma conta'}
                searchable={false}
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vincule o cartão a uma conta bancária para herdar automaticamente a cor.
          </p>
        </div>
      </>
    );
  }

  // Campos editáveis de cartão de crédito na edição
  if (account && account.type === 'CREDIT') {
    return (
      <>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t.closingDay || 'Dia de Fechamento'}
          </label>
          <input
            type="number"
            {...register('closingDay', { valueAsNumber: true })}
            className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm"
            placeholder={suggestedClosing ? String(suggestedClosing) : '1-31'}
            min="1"
            max="31"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t.closingDayFromDueHint}
          </p>
          {errors.closingDay && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.closingDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Conta Bancária Vinculada
          </label>
          <Controller
            name="linkedAccountId"
            control={control}
            render={({ field }) => (
              <SelectCombobox
                value={field.value || ''}
                onValueChange={(value) => {
                  field.onChange(value || undefined);
                  // Herdar cor automaticamente quando selecionar banco
                  if (value) {
                    const linkedAccount = bankAccountsForLinking.find(acc => acc.id === value);
                    if (linkedAccount?.color) {
                      setValue('color', linkedAccount.color);
                    }
                  }
                }}
                options={[
                  { value: '', label: t.none || 'Nenhuma' },
                  ...bankAccountsForLinking.map(acc => ({ 
                    value: acc.id || '', 
                    label: acc.name 
                  }))
                ]}
                placeholder={t.selectAccount || 'Selecione uma conta'}
                searchable={false}
              />
            )}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Vincule o cartão a uma conta bancária para herdar automaticamente a cor.
          </p>
        </div>
      </>
    );
  }

  return null;
};
