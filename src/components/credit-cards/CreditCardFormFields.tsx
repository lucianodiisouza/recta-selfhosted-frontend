import { useI18n } from '../../context/I18nContext';
import { parseCurrencyValue } from '../../utils/currency';
import type { UseFormReturn, UseFormSetValue } from 'react-hook-form';

interface CreditCardFormFieldsProps {
  form: UseFormReturn<any>;
  creditLimitMask: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  balanceMask?: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  // Only passed when editing: "available limit today" (fdbk #108)
  availableLimitMask?: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void };
  // Loose type so the parent can pass either a strict UseFormSetValue or a relaxed
  // string-based setValue without a type error.
  setValue: UseFormSetValue<any> | ((name: string, value: any, options?: any) => void);
  isCreation: boolean;
}

export const CreditCardFormFields = ({
  form,
  creditLimitMask,
  balanceMask,
  availableLimitMask,
  setValue,
  isCreation,
}: CreditCardFormFieldsProps) => {
  const { t } = useI18n();
  const { register, formState: { errors } } = form;

  return (
    <>
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.accountName || 'Nome do Cartão'}
        </label>
        <input
          type="text"
          {...register('name')}
          className={`field-control ${
            errors.name ? 'border-negative/60' : 'border-line'
          }`}
          placeholder={t.accountNamePlaceholder || 'Ex: Nubank, Inter...'}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{(errors.name as { message?: string }).message ?? ''}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
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
          className={`field-control ${
            errors.creditLimit ? 'border-negative/60' : ''
          }`}
        />
        <input
          type="hidden"
          {...register('creditLimit', { valueAsNumber: true })}
        />
        {errors.creditLimit && (
          <p className="mt-1 text-sm text-negative">{(errors.creditLimit as { message?: string }).message ?? ''}</p>
        )}
      </div>
      
      {!isCreation && availableLimitMask && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.availableLimitToday}
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={availableLimitMask.value}
            onChange={(e) => {
              availableLimitMask.onChange(e);
              const numericValue = parseCurrencyValue(e.target.value);
              setValue('availableLimit', numericValue, { shouldDirty: true });
            }}
            placeholder={t.currencyPlaceholder || '0,00'}
            className={`field-control ${
              errors.availableLimit ? 'border-negative/60' : ''
            }`}
          />
          <p className="mt-1 text-xs font-light text-content-tertiary">
            {t.availableLimitTodayHint}
          </p>
          {errors.availableLimit && (
            <p className="mt-1 text-sm text-negative">{(errors.availableLimit as { message?: string }).message ?? ''}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.dueDay}
        </label>
        <input
          type="number"
          {...register('dueDay', { valueAsNumber: true })}
          className={`field-control ${
            errors.dueDay ? 'border-negative/60' : ''
          }`}
          placeholder="1-31"
          min="1"
          max="31"
        />
        {errors.dueDay && (
          <p className="mt-1 text-sm text-negative">{(errors.dueDay as { message?: string }).message ?? ''}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.bestDayOffset || 'Dias antes do vencimento (melhor dia)'}
        </label>
        <input
          type="number"
          {...register('bestDayOffset', { valueAsNumber: true })}
          className={`field-control ${
            errors.bestDayOffset ? 'border-negative/60' : ''
          }`}
          placeholder="10"
          min="1"
          max="30"
        />
        <p className="mt-1 text-xs font-light text-content-tertiary">
          {t.bestDayOffsetHint || 'Quantos dias antes do vencimento indica o melhor dia para compra. Padrão: 10.'}
        </p>
        {errors.bestDayOffset && (
          <p className="mt-1 text-sm text-negative">{(errors.bestDayOffset as { message?: string }).message ?? ''}</p>
        )}
      </div>

      {/* Dívida inicial só aparece na criação, não na edição */}
      {isCreation && balanceMask && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
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
            className="field-control"
            placeholder={t.currencyPlaceholder || '0,00'}
          />
          <input
            type="hidden"
            {...register('balance', { valueAsNumber: true })}
          />
          {errors.balance && (
            <p className="mt-1 text-sm text-negative">{(errors.balance as { message?: string }).message ?? ''}</p>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.color}
        </label>
        <input
          type="color"
          {...register('color')}
          className="block w-full h-10 p-1 border border-line rounded-md bg-surface-elevated"
        />
      </div>
    </>
  );
};
