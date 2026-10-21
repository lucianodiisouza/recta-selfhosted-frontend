import { Controller, Control, FieldErrors, UseFormWatch } from 'react-hook-form';
import { AlertCircle } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { AccountType } from '../../lib/enums';
import { TransactionFormData } from '../../schemas';
import SelectCombobox from '../SelectCombobox';
import type { Account as AccountWithPersonal } from '../../hooks/api/useAccounts';

interface AccountFieldProps {
  control: Control<TransactionFormData>;
  watch: UseFormWatch<TransactionFormData>;
  errors: FieldErrors<TransactionFormData>;
  availableAccounts: AccountWithPersonal[];
  isCreditCardContext: boolean;
  hasNoAccountsAvailable: boolean;
  authUser?: { id: string } | null;
  disabled?: boolean;
}

export const AccountField = ({
  control,
  watch: _watch,
  errors,
  availableAccounts,
  isCreditCardContext,
  hasNoAccountsAvailable,
  authUser,
  disabled = false,
}: AccountFieldProps) => {
  const { t } = useI18n();

  return (
    <div>
      <label className="block text-sm font-medium text-content-secondary mb-1">
        {isCreditCardContext ? t.creditCard : t.account}
      </label>
      
      {hasNoAccountsAvailable && (
        <div className="mb-3 p-3 bg-warning/10 border border-warning/25 rounded-lg">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
                {t.noAccountsAvailable}
              </p>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                {t.noAccountsAvailableMessage}
              </p>
            </div>
          </div>
        </div>
      )}
      
      <Controller
        name="accountId"
        control={control}
        render={({ field }) => (
          <SelectCombobox
            value={field.value || ''}
            onValueChange={field.onChange}
            options={[
              { value: '', label: t.selectAccount },
              ...availableAccounts.map((account: AccountWithPersonal) => {
                const isCredit = account.type === AccountType.CREDIT;
                const isCash = account.type === AccountType.CASH;
                const isPersonal = account.isPersonal === true;
                const accountOwnerId = account.accountOwnerId;
                const isOtherMemberAccount = isPersonal && accountOwnerId && accountOwnerId !== authUser?.id;
                
                let accountTypeLabel = '';
                if (isCredit) {
                  accountTypeLabel = t.creditCard;
                } else if (isCash) {
                  accountTypeLabel = t.cash;
                }
                
                let label = accountTypeLabel ? `${accountTypeLabel} - ${account.name}` : account.name;
                
                if (isPersonal) {
                  if (isOtherMemberAccount) {
                    label = `${label} ${t.otherMemberPersonalAccount}`;
                  } else {
                    label = `${label} ${t.myPersonalAccount}`;
                  }
                }
                
                return {
                  value: account.id || '',
                  label
                };
              })
            ]}
            placeholder={hasNoAccountsAvailable ? t.noAccountsAvailable : t.selectAccount}
            disabled={disabled || hasNoAccountsAvailable}
          />
        )}
      />
      {errors.accountId && (
        <p className="mt-1 text-sm text-negative">{errors.accountId.message}</p>
      )}
    </div>
  );
};
