import { Controller } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { parseCurrencyValue } from '../../utils/currency';
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

  // Campos específicos de cartão de crédito - só aparecem na criação
  if (isCreation) {
    return (
      <>
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
            <p className="mt-1 text-sm text-negative">{errors.creditLimit.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.dueDay || 'Dia de Vencimento'}
          </label>
          <input
            type="number"
            {...register('dueDay', { valueAsNumber: true })}
            className="field-control"
            placeholder="1-31"
            min="1"
            max="31"
          />
          {errors.dueDay && (
            <p className="mt-1 text-sm text-negative">{errors.dueDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.closingDay || 'Dia de Fechamento'}
          </label>
          <input
            type="number"
            {...register('closingDay', { valueAsNumber: true })}
            className="field-control"
            placeholder="1-31"
            min="1"
            max="31"
          />
          <p className="mt-1 text-xs text-content-tertiary">
            {t.closingDayHint || 'Dia em que a fatura fecha. Ex: se fecha no dia 7, a fatura inclui compras do dia 7 do mês anterior até o dia 6 do mês atual.'}
          </p>
          {errors.closingDay && (
            <p className="mt-1 text-sm text-negative">{errors.closingDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
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
          <p className="mt-1 text-xs text-content-tertiary">
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
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.closingDay || 'Dia de Fechamento'}
          </label>
          <input
            type="number"
            {...register('closingDay', { valueAsNumber: true })}
            className="field-control"
            placeholder="1-31"
            min="1"
            max="31"
          />
          <p className="mt-1 text-xs text-content-tertiary">
            {t.closingDayHint || 'Dia em que a fatura fecha. Ex: se fecha no dia 7, a fatura inclui compras do dia 7 do mês anterior até o dia 6 do mês atual.'}
          </p>
          {errors.closingDay && (
            <p className="mt-1 text-sm text-negative">{errors.closingDay.message}</p>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
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
          <p className="mt-1 text-xs text-content-tertiary">
            Vincule o cartão a uma conta bancária para herdar automaticamente a cor.
          </p>
        </div>
      </>
    );
  }

  return null;
};
