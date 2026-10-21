import { Controller, Control, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { AccountType } from '../../lib/enums';
import { TransactionFormData } from '../../schemas';
import SelectCombobox from '../SelectCombobox';
import type { Account } from '../../types';

interface TransferFormFieldsProps {
  control: Control<TransactionFormData>;
  watch: UseFormWatch<TransactionFormData>;
  setValue: UseFormSetValue<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  accounts: Account[];
  disabled?: boolean;
}

export const TransferFormFields = ({ 
  control, 
  watch, 
  setValue, 
  errors, 
  accounts, 
  disabled 
}: TransferFormFieldsProps) => {
  const { t } = useI18n();

  const fromAccountId = watch('fromAccountId');
  const availableDestAccounts = accounts.filter(
    a => a.type !== AccountType.CREDIT && a.id !== fromAccountId
  );

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.fromAccount}
        </label>
        <Controller
          name="fromAccountId"
          control={control}
          render={({ field }) => (
            <SelectCombobox
              value={field.value || ''}
              onValueChange={(value) => {
                field.onChange(value);
                const toAccountId = watch('toAccountId');
                if (toAccountId === value) {
                  setValue('toAccountId', '', { shouldValidate: true });
                }
              }}
              options={[
                { value: '', label: t.selectAccount },
                ...accounts.filter(a => a.type !== AccountType.CREDIT).map(account => ({
                  value: account.id || '',
                  label: account.name
                }))
              ]}
              placeholder={t.selectAccount}
              disabled={disabled}
            />
          )}
        />
        {errors.fromAccountId && (
          <p className="mt-1 text-sm text-negative">{errors.fromAccountId.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.toAccount}
        </label>
        <Controller
          name="toAccountId"
          control={control}
          render={({ field }) => (
            <SelectCombobox
              value={field.value || ''}
              onValueChange={(value) => {
                field.onChange(value);
                const currentFromAccountId = watch('fromAccountId');
                if (currentFromAccountId === value) {
                  setValue('fromAccountId', '', { shouldValidate: true });
                }
              }}
              options={[
                { value: '', label: t.selectAccount },
                ...availableDestAccounts.map(account => ({
                  value: account.id || '',
                  label: account.name
                }))
              ]}
              placeholder={t.selectAccount}
              disabled={disabled}
            />
          )}
        />
        {errors.toAccountId && (
          <p className="mt-1 text-sm text-negative">{errors.toAccountId.message}</p>
        )}
      </div>
    </>
  );
};
