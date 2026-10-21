import { Controller, Control, FieldErrors } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { AccountType, TransactionType } from '../../lib/enums';
import { TransactionFormData } from '../../schemas';
import { SegmentedControl } from '../ui';
import type { Account } from '../../types';

interface TransactionTypeSelectorProps {
  control: Control<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  accounts: Account[];
  disabled?: boolean;
}

export const TransactionTypeSelector = ({ control, errors, accounts, disabled }: TransactionTypeSelectorProps) => {
  const { t } = useI18n();

  // Expense first, like the app's capture sheet.
  const typeOptions = [
    { value: TransactionType.EXPENSE, label: t.expense },
    { value: TransactionType.INCOME, label: t.income },
  ];

  if (accounts.filter(a => a.type !== AccountType.CREDIT).length >= 2) {
    typeOptions.push({ value: TransactionType.TRANSFER, label: t.transfer });
  }

  return (
    <div>
      <Controller
        name="type"
        control={control}
        render={({ field }) => (
          <SegmentedControl
            label={t.type}
            value={field.value || ''}
            onChange={field.onChange}
            options={typeOptions}
            disabled={disabled}
            fullWidth
          />
        )}
      />
      {errors.type && (
        <p className="mt-1 text-sm text-negative">{errors.type.message}</p>
      )}
    </div>
  );
};
