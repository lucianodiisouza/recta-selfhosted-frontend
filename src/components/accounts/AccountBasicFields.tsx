import { useEffect, useState } from 'react';
import { Controller } from 'react-hook-form';
import { useI18n } from '../../context/I18nContext';
import { AccountType } from '../../lib/enums';
import { getAccountTypeLabel } from '../../constants/accountTypes';
import { formatCurrency } from '../../utils/format';
import { getDisplayBalance } from '../../utils/accountBalance';
import { parseCurrencyValue } from '../../utils/currency';
import SelectCombobox from '../SelectCombobox';
import { Switch } from '../ui/Switch';
import type { AccountFormData } from '../../schemas';
import type { Account } from '../../types';
import type { UseFormReturn } from 'react-hook-form';

interface AccountBasicFieldsProps {
  account: Account | null;
  form: UseFormReturn<AccountFormData>;
  currencyMask: { value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; setValue: (value: number) => void };
  accountTypeOptions: Array<{ value: string; label: string }>;
  defaultType: AccountType;
  baseCurrency: string;
  setValue: (name: keyof AccountFormData, value: any, options?: any) => void;
}

export const AccountBasicFields = ({
  account,
  form,
  currencyMask,
  accountTypeOptions,
  defaultType,
  baseCurrency,
  setValue,
}: AccountBasicFieldsProps) => {
  const { t } = useI18n();
  const { register, control, watch, formState: { errors } } = form;
  const accountType = watch('type');
  // Conta que já começa no negativo (cheque especial, fdbk #133). O valor segue digitado
  // positivo e vai com sinal; cartão não entra aqui (a dívida do cartão já é positiva).
  const [startsNegative, setStartsNegative] = useState(false);
  const canStartNegative = accountType !== AccountType.CREDIT;
  const signedBalance = (amount: number, negative: boolean) =>
    negative && canStartNegative ? -Math.abs(amount) : Math.abs(amount);
  // Trocar para cartão com o interruptor ligado não pode mandar dívida negativa.
  useEffect(() => {
    if (account) return;
    setValue('balance', signedBalance(parseCurrencyValue(currencyMask.value), startsNegative));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canStartNegative]);

  return (
    <>
      {/* Nome da conta */}
      <div>
        <label className="block text-sm font-medium text-content-secondary mb-1">
          {t.accountName}
        </label>
        <input
          type="text"
          {...register('name')}
          className={`field-control ${
            errors.name ? 'border-negative/60' : 'border-line'
          }`}
        />
        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
      </div>

      {/* Tipo de conta só aparece na criação, não na edição */}
      {!account && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.accountType}
          </label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => {
              // Se defaultType for CREDIT, permitir CREDIT; caso contrário, filtrar apenas CREDIT
              const filteredOptions = defaultType === AccountType.CREDIT
                ? accountTypeOptions.filter(opt => opt.value === AccountType.CREDIT)
                : accountTypeOptions.filter(opt => opt.value !== AccountType.CREDIT);
              return (
                <SelectCombobox
                  value={field.value}
                  onValueChange={(value) => field.onChange(value as AccountType)}
                  options={filteredOptions}
                  placeholder={t.selectAccountType || t.select}
                />
              );
            }}
          />
          {errors.type && (
            <p className="mt-1 text-sm text-negative">{errors.type.message}</p>
          )}
        </div>
      )}
      
      {/* Mostrar tipo de conta quando estiver editando */}
      {account && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.accountType}
          </label>
          <div className="block w-full px-3 py-2 border border-line rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-content">
            {getAccountTypeLabel(account.type, t as unknown as Record<string, string>)}
          </div>
        </div>
      )}

      {/* Saldo inicial só aparece na criação, não na edição */}
      {!account && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {accountType === AccountType.CREDIT ? t.initialDebt : t.initialBalance}
          </label>
          <input
            type="text"
            value={currencyMask.value}
            onChange={(e) => {
              currencyMask.onChange(e);
              const numericValue = parseCurrencyValue(e.target.value);
              setValue('balance', signedBalance(numericValue, startsNegative), { shouldValidate: true });
            }}
            className={`field-control ${startsNegative && canStartNegative ? 'text-negative' : ''}`}
          />
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
                  setValue('balance', signedBalance(parseCurrencyValue(currencyMask.value), on), { shouldValidate: true });
                }}
              />
            </div>
          )}
        </div>
      )}
      
      {/* Mostrar saldo atual quando estiver editando */}
      {account && (
        <div>
          <label className="block text-sm font-medium text-content-secondary mb-1">
            {t.currentBalance || 'Saldo Atual'}
          </label>
          <div className="block w-full px-3 py-2 border border-line rounded-md shadow-sm bg-gray-50 dark:bg-gray-700 text-content">
            {formatCurrency(getDisplayBalance(account), baseCurrency || 'BRL')}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t.balanceAndTypeEditHint || 'O saldo e o tipo da conta bancária não podem ser editados aqui. Se precisar alterar esses valores, você pode deletar esta conta bancária e criar uma nova. Os cálculos serão refeitos automaticamente.'}
          </p>
        </div>
      )}
    </>
  );
};
