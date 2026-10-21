import { UseFormRegister, FieldErrors } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { TransactionFormData } from '../../schemas';

interface InstallmentsFieldProps {
  register: UseFormRegister<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  disabled?: boolean;
}

export const InstallmentsField = ({ register, errors, disabled }: InstallmentsFieldProps) => {
  const { t } = useI18n();

  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">
        {t.installments}
      </label>
      <input
        type="number"
        min="1"
        max="120"
        {...register('installments', { valueAsNumber: true })}
        disabled={disabled}
        readOnly={disabled}
        className={`field-control ${disabled ? 'bg-gray-100 dark:bg-gray-900/50 text-content-tertiary cursor-not-allowed' : ''}`}
        placeholder="1"
      />
      <p className="mt-1 text-xs text-content-tertiary">
        {t.installments} ({t.newTransaction})
      </p>
      {errors.installments && (
        <p className="mt-1 text-sm text-negative">{errors.installments.message}</p>
      )}
    </div>
  );
};
