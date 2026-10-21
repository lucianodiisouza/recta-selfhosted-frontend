import { useState, useRef, useCallback } from 'react';
import { Divide, Users, DollarSign } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';
import { useCurrency } from '../../context/CurrencyContext';
import { formatCurrency } from '../../utils/format';
import { getAvailableBalance } from '../../utils/accountBalance';
import { AccountType } from '../../lib/enums';
import SelectCombobox from '../SelectCombobox';
import type { Account as AccountWithPersonal } from '../../hooks/api/useAccounts';
import type { HouseholdMember } from '../../hooks/api/useHouseholds';

interface Split {
  userId: string;
  amount: number;
  accountId?: string;
}

interface SplitTransactionFormProps {
  isSplit: boolean;
  onSplitChange: (isSplit: boolean) => void;
  splits: Split[];
  onSplitsChange: (splits: Split[]) => void;
  transactionAmount: number;
  householdMembers?: HouseholdMember[];
  accounts: AccountWithPersonal[];
  splitBalanceErrors: Record<string, string>;
  getDefaultAccountIdForMember: (memberUserId: string, isCurrentUserMember: boolean) => string | undefined;
  disabled?: boolean;
  currentUser: any;
  authUser?: { id: string } | null;
}

export const SplitTransactionForm = ({
  isSplit,
  onSplitChange,
  splits,
  onSplitsChange,
  transactionAmount,
  householdMembers,
  accounts,
  splitBalanceErrors,
  getDefaultAccountIdForMember,
  disabled = false,
  currentUser,
  authUser,
}: SplitTransactionFormProps) => {
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});
  const recalculateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasAutoSplit = useRef(false);
  const lastMemberCount = useRef(0);

  const handleDivideEqually = useCallback(() => {
    if (!householdMembers || transactionAmount <= 0) return;

    const activeMembers = householdMembers.filter((m: HouseholdMember) => 
      m.user && m.user.email && (m.role === 'EDITOR' || m.role === 'OWNER')
    );

    if (activeMembers.length === 0) return;

    const amountPerPerson = transactionAmount / activeMembers.length;
    const roundedAmount = Math.round(amountPerPerson * 100) / 100;

    const newSplits = activeMembers.map((member: HouseholdMember, index: number) => {
      const existingSplit = splits.find(s => s.userId === member.userId);
      const isCurrentUserMember = member.userId === (authUser?.id || currentUser?.uid);
      const defaultAccountId = existingSplit?.accountId || getDefaultAccountIdForMember(member.userId, isCurrentUserMember);
      
      if (index === activeMembers.length - 1) {
        const totalSoFar = roundedAmount * (activeMembers.length - 1);
        return {
          userId: member.userId,
          amount: Math.round((transactionAmount - totalSoFar) * 100) / 100,
          accountId: defaultAccountId,
        };
      }
      return {
        userId: member.userId,
        amount: roundedAmount,
        accountId: defaultAccountId,
      };
    });

    onSplitsChange(newSplits);
    setLocalInputValues({});
    hasAutoSplit.current = true;
    lastMemberCount.current = activeMembers.length;
  }, [householdMembers, transactionAmount, splits, getDefaultAccountIdForMember, authUser, currentUser, onSplitsChange]);

  if (!householdMembers || householdMembers.length <= 1 || disabled) {
    return null;
  }

  return (
    <div className="space-y-3 border-t pt-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Divide className="h-5 w-5 text-content-secondary" />
          <label htmlFor="isSplit" className="block text-sm font-medium text-content-secondary cursor-pointer">
            {t.splitExpenseBetweenMembers}
          </label>
        </div>
        <input
          type="checkbox"
          id="isSplit"
          checked={isSplit}
          onChange={(e) => {
            const newIsSplit = e.target.checked;
            onSplitChange(newIsSplit);
            if (!newIsSplit) {
              onSplitsChange([]);
              hasAutoSplit.current = false;
              lastMemberCount.current = 0;
            }
          }}
          disabled={disabled || !transactionAmount || transactionAmount <= 0}
          className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ${disabled || !transactionAmount || transactionAmount <= 0 ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        />
      </div>
      
      {isSplit && transactionAmount > 0 && splits.length > 0 && (
        <div className="space-y-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg p-4 border border-line">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-content-secondary">
              {t.splitBetweenMembers}
            </p>
            <button
              type="button"
              onClick={handleDivideEqually}
              className="text-xs text-brand hover:text-primary-700 dark:hover:text-primary-300 font-medium"
            >
              {t.divideEqually}
            </button>
          </div>
          
          {splits.map((split, index) => {
            const member = householdMembers?.find((m: HouseholdMember) => m.userId === split.userId);
            if (!member || !member.user) return null;
            
            const displayName = member.user.displayName || member.user.email?.split('@')[0] || t.user;
            const isCurrentUserMember = member.userId === (currentUser as any)?.uid;
            
            const availableAccountsForMember = accounts.filter((account: AccountWithPersonal) => {
              if (isCurrentUserMember) {
                return true;
              } else {
                return account.accountOwnerId === member.userId || !account.isPersonal;
              }
            });

            return (
              <div key={split.userId} className="space-y-2 p-3 bg-surface-elevated rounded-md border border-line">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm text-content-secondary font-medium">
                      {displayName}
                      {isCurrentUserMember && <span className="ml-1 text-xs text-gray-500">{t.youLabel}</span>}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <DollarSign className="h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={localInputValues[split.userId] !== undefined 
                        ? localInputValues[split.userId]
                        : split.amount.toFixed(2).replace('.', ',')}
                      className={`flex-1 px-2 py-1 text-sm border rounded-md bg-surface-elevated text-content focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                        splitBalanceErrors[split.userId]
                          ? 'border-negative/60'
                          : 'border-line'
                      }`}
                      onChange={(e) => {
                        const inputValue = e.target.value;
                        setLocalInputValues(prev => ({
                          ...prev,
                          [split.userId]: inputValue
                        }));
                        
                        if (recalculateTimeoutRef.current) {
                          clearTimeout(recalculateTimeoutRef.current);
                        }
                        
                        recalculateTimeoutRef.current = setTimeout(() => {
                          setLocalInputValues(currentLocalValues => {
                            const currentInputValue = currentLocalValues[split.userId] !== undefined 
                              ? currentLocalValues[split.userId]
                              : inputValue;
                            const rawValueFromInput = currentInputValue.replace(/[^\d,.-]/g, '').replace(',', '.');
                            const finalAmount = Math.max(0, Math.min(transactionAmount, parseFloat(rawValueFromInput) || 0));
                            
                            if (!isNaN(finalAmount)) {
                              onSplitsChange(prevSplits => {
                                const currentSplits = [...prevSplits];
                                currentSplits[index] = { ...split, amount: finalAmount };
                                
                                const remaining = transactionAmount - finalAmount;
                                const otherSplits = currentSplits.filter((_, i) => i !== index);
                                
                                if (otherSplits.length > 0 && remaining >= 0) {
                                  const amountPerOther = remaining / otherSplits.length;
                                  const roundedAmount = Math.round(amountPerOther * 100) / 100;
                                  
                                  let otherIndex = 0;
                                  for (let i = 0; i < currentSplits.length; i++) {
                                    if (i !== index) {
                                      if (otherIndex === otherSplits.length - 1) {
                                        const totalSoFar = roundedAmount * (otherSplits.length - 1) + finalAmount;
                                        currentSplits[i] = { ...currentSplits[i], amount: Math.round((transactionAmount - totalSoFar) * 100) / 100 };
                                      } else {
                                        currentSplits[i] = { ...currentSplits[i], amount: roundedAmount };
                                      }
                                      otherIndex++;
                                    }
                                  }
                                }
                                
                                return currentSplits;
                              });
                            }
                            
                            const newValues = { ...currentLocalValues };
                            delete newValues[split.userId];
                            return newValues;
                          });
                        }, 800);
                      }}
                      onBlur={(e) => {
                        if (recalculateTimeoutRef.current) {
                          clearTimeout(recalculateTimeoutRef.current);
                          recalculateTimeoutRef.current = null;
                        }
                        
                        const inputValue = e.target.value;
                        const rawValue = inputValue.replace(/[^\d,.-]/g, '').replace(',', '.');
                        const newAmount = Math.max(0, Math.min(transactionAmount, parseFloat(rawValue) || 0));
                        const roundedAmount = Math.round(newAmount * 100) / 100;
                        const newSplits = [...splits];
                        newSplits[index] = { ...split, amount: roundedAmount };
                        
                        const remaining = transactionAmount - roundedAmount;
                        const otherSplits = newSplits.filter((_, i) => i !== index);
                        
                        if (otherSplits.length > 0 && remaining >= 0) {
                          const amountPerOther = remaining / otherSplits.length;
                          const roundedAmountPerOther = Math.round(amountPerOther * 100) / 100;
                          
                          let otherIndex = 0;
                          for (let i = 0; i < newSplits.length; i++) {
                            if (i !== index) {
                              if (otherIndex === otherSplits.length - 1) {
                                const totalSoFar = roundedAmountPerOther * (otherSplits.length - 1) + roundedAmount;
                                newSplits[i] = { ...newSplits[i], amount: Math.round((transactionAmount - totalSoFar) * 100) / 100 };
                              } else {
                                newSplits[i] = { ...newSplits[i], amount: roundedAmountPerOther };
                              }
                              otherIndex++;
                            }
                          }
                        }
                        
                        onSplitsChange(newSplits);
                        setLocalInputValues(prev => {
                          const newValues = { ...prev };
                          delete newValues[split.userId];
                          return newValues;
                        });
                      }}
                      placeholder="0,00"
                      disabled={disabled}
                    />
                  </div>
                  {splitBalanceErrors[split.userId] && (
                    <p className="text-xs text-negative">
                      {splitBalanceErrors[split.userId]}
                    </p>
                  )}
                  {split.accountId && (() => {
                    const selectedAccount = accounts.find(a => a.id === split.accountId) as AccountWithPersonal | undefined;
                    if (selectedAccount) {
                      const availableBalance = getAvailableBalance(selectedAccount);
                      return (
                        <p className="text-xs text-content-tertiary">
                          {t.availableBalance}: {formatCurrency(availableBalance, baseCurrency)}
                        </p>
                      );
                    }
                    return null;
                  })()}
                  <div>
                    <label className="block text-xs text-content-secondary mb-1">
                      {t.accountToPay}
                    </label>
                    <SelectCombobox
                      value={split.accountId || ''}
                      onValueChange={(value) => {
                        const newSplits = [...splits];
                        newSplits[index] = { ...split, accountId: value || undefined };
                        onSplitsChange(newSplits);
                      }}
                      options={[
                        { value: '', label: t.selectAccount },
                        ...availableAccountsForMember.map((account) => {
                          const isCredit = account.type === AccountType.CREDIT;
                          const isCash = account.type === AccountType.CASH;
                          const isPersonal = account.isPersonal === true;
                          
                          let accountTypeLabel = '';
                          if (isCredit) {
                            accountTypeLabel = t.creditCard;
                          } else if (isCash) {
                            accountTypeLabel = t.cash;
                          }
                          
                          let label = accountTypeLabel ? `${accountTypeLabel} - ${account.name}` : account.name;
                          
                          if (isPersonal) {
                            label = `${label} ${t.personalAccount}`;
                          }
                          
                          return {
                            value: account.id || '',
                            label
                          };
                        })
                      ]}
                      placeholder={t.selectAccount}
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
          
          <div className="mt-3 pt-3 border-t border-line">
            <div className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">{t.totalSplit}</span>
              <span className={`font-medium ${
                Math.abs(splits.reduce((sum, s) => sum + s.amount, 0) - transactionAmount) <= 0.01
                  ? 'text-positive'
                  : 'text-negative'
              }`}>
                {formatCurrency(splits.reduce((sum, s) => sum + s.amount, 0), baseCurrency)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-gray-500 dark:text-gray-500">{t.totalAmount}</span>
              <span className="font-medium text-content-secondary">
                {formatCurrency(transactionAmount, baseCurrency)}
              </span>
            </div>
            {Math.abs(splits.reduce((sum, s) => sum + s.amount, 0) - transactionAmount) > 0.01 && (
              <p className="mt-2 text-xs text-negative">
                {t.splitSumMustEqualTotal}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
