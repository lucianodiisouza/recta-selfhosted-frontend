import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTransactions } from '../context/TransactionsContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { Account } from '../types';
import { AccountType } from '../lib/enums';
import { analyticsHelpers } from '../utils/analytics';
import { getCreditCardUsage } from '../utils/accountBalance';
import {
  availableLimitChanged,
  effectiveCardLimit,
  validateAvailableLimit,
} from '../utils/creditCardLimit';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useHouseholds, useUpdateSharedAccountIds, useHouseholdMembers } from '../hooks/api/useHouseholds';
import { useAuth } from '../context/AuthContext';
import {
  CreditCardModalHeader,
  CreditCardFormFields,
  CreditCardModalFooter,
} from './credit-cards';
import { AccountSharingToggle } from './accounts';

interface CreditCardModalProps {
  account: Account | null;
  onClose: () => void;
}

interface CreditCardFormData {
  name: string;
  color: string;
  balance?: number;
  creditLimit?: number;
  availableLimit?: number;
  dueDay?: number;
  bestDayOffset?: number;
}

export const CreditCardModal = ({ account, onClose }: CreditCardModalProps) => {
  const { addAccount, updateAccount } = useTransactions();
  const { t } = useI18n();
  const { success, error: showError } = useToastContext();
  const { householdId: currentHouseholdId } = useDefaultHousehold();
  const { data: households } = useHouseholds();
  const { currentUser } = useAuth();
  const updateSharedAccountIds = useUpdateSharedAccountIds();
  
  const creditLimitMask = useCurrencyMask();
  const balanceMask = useCurrencyMask();
  const availableLimitMask = useCurrencyMask();
  // Available limit the card shows today; the field starts here and is only sent if changed.
  const originalAvailableLimit = account ? getCreditCardUsage(account).available : 0;
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // Determine if we're in a personal household (first household is personal)
  const personalHousehold = useMemo(() => {
    if (!households || households.length === 0) return null;
    return households[0]; // First household is personal
  }, [households]);
  
  const isInPersonalHousehold = useMemo(() => {
    return currentHouseholdId === personalHousehold?.id;
  }, [currentHouseholdId, personalHousehold]);
  
  // Get shared household (if exists, it's the second one)
  const sharedHousehold = useMemo(() => {
    if (!households || households.length < 2) return null;
    return households[1]; // Second household is the shared one
  }, [households]);
  
  // Get current member's shared account IDs if in shared household
  const { data: sharedHouseholdMembers } = useHouseholdMembers(sharedHousehold?.id || '');
  const currentMember = useMemo(() => {
    if (!sharedHouseholdMembers || !currentUser) return null;
    return sharedHouseholdMembers.find(m => m.userId === currentUser.uid);
  }, [sharedHouseholdMembers, currentUser]);
  
  const isAccountShared = useMemo(() => {
    if (!account?.id || !currentMember?.sharedAccountIds) return false;
    return currentMember.sharedAccountIds.includes(account.id);
  }, [account?.id, currentMember]);
  
  const [isSharingAccount, setIsSharingAccount] = useState(isAccountShared);
  
  // Sync isSharingAccount when account or currentMember changes
  useEffect(() => {
    setIsSharingAccount(isAccountShared);
  }, [isAccountShared]);

  const creditCardSchema = z.object({
    name: z.string().min(1, t.nameRequired).max(100, t.nameTooLong),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, t.invalidColor),
    balance: z.number().optional(),
    creditLimit: z.number().positive(t.cardLimitMustBePositive).optional(),
    availableLimit: z.number().min(0, t.availableLimitNegative).optional(),
    dueDay: z.number().int().min(1, t.dueDayMin).max(31, t.dueDayMax).optional(),
    bestDayOffset: z.number().int().min(1).max(30).optional(),
  });

  const form = useForm<CreditCardFormData>({
    resolver: zodResolver(creditCardSchema),
    defaultValues: {
      name: '',
      color: '#3b82f6',
      balance: 0,
      creditLimit: undefined,
      dueDay: undefined,
      bestDayOffset: 10,
    },
  });

  const { handleSubmit, reset, setValue } = form;
  const { errors: _errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        color: account.color,
        creditLimit: account.creditLimit || undefined,
        availableLimit: originalAvailableLimit,
        dueDay: account.dueDay || undefined,
        bestDayOffset: account.bestDayOffset ?? 10,
      });
      creditLimitMask.setValue(account.creditLimit || 0);
      availableLimitMask.setValue(originalAvailableLimit);
    } else {
      reset({
        name: '',
        color: '#3b82f6',
        balance: 0,
        creditLimit: undefined,
        dueDay: undefined,
        bestDayOffset: 10,
      });
      creditLimitMask.setValue(0);
      balanceMask.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, reset]);

  const onSubmit = async (data: CreditCardFormData) => {
    if (isLoading) {
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (account?.id) {
        // Limite disponível hoje (fdbk #108): só vai no PATCH se a pessoa mudou o valor.
        const sendAvailableLimit = availableLimitChanged(data.availableLimit, originalAvailableLimit);
        if (sendAvailableLimit) {
          const limitError = validateAvailableLimit(
            data.availableLimit,
            effectiveCardLimit(data.creditLimit, account),
          );
          if (limitError) {
            const message = limitError === 'negative' ? t.availableLimitNegative : t.availableLimitAboveLimit;
            form.setError('availableLimit', { type: 'validate', message });
            showError(message);
            return;
          }
        }

        // Edição: permite editar nome, cor, limite de crédito, limite disponível, dia de vencimento e melhor dia
        await updateAccount(account.id, {
          name: data.name,
          color: data.color,
          creditLimit: data.creditLimit,
          ...(sendAvailableLimit ? { availableLimit: data.availableLimit } : {}),
          dueDay: data.dueDay,
          bestDayOffset: data.bestDayOffset,
        });
        
        // Atualizar compartilhamento se necessário
        if (isInPersonalHousehold && sharedHousehold && isSharingAccount !== isAccountShared) {
          const currentSharedIds = currentMember?.sharedAccountIds || [];
          let newSharedIds: string[];
          
          if (isSharingAccount) {
            // Adicionar cartão aos compartilhados
            newSharedIds = [...currentSharedIds, account.id];
          } else {
            // Remover cartão dos compartilhados
            newSharedIds = currentSharedIds.filter(id => id !== account.id);
          }
          
          await updateSharedAccountIds.mutateAsync({
            householdId: sharedHousehold.id,
            sharedAccountIds: newSharedIds,
          });
        }
        
        analyticsHelpers.logCreditCardUpdated();
        success(t.accountUpdated || 'Cartão atualizado com sucesso!');
        onClose();
      } else {
        // Criação: cria novo cartão de crédito
        await addAccount({
          name: data.name,
          type: AccountType.CREDIT,
          color: data.color,
          balance: data.balance || 0,
          creditLimit: data.creditLimit,
          dueDay: data.dueDay,
          bestDayOffset: data.bestDayOffset ?? 10,
        } as Omit<Account, 'id' | 'userId'>);
        analyticsHelpers.logCreditCardCreated();
        success(t.accountCreated || 'Cartão criado com sucesso!');
        onClose();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar cartão';
      showError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop"
          onClick={onClose}
        />
        <div className="relative z-50 w-full max-w-md overflow-hidden bg-surface-elevated rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
          <CreditCardModalHeader isEditing={!!account} onClose={onClose} />

          <div className="p-6">
            <form onSubmit={handleSubmit(
              (data) => {
                onSubmit(data);
              },
              (errors) => {
                const firstError = Object.values(errors)[0];
                if (firstError) {
                  showError(firstError.message || t.formValidationError);
                }
              }
            )} className="space-y-4">
              <CreditCardFormFields
                form={form}
                creditLimitMask={creditLimitMask}
                balanceMask={!account ? balanceMask : undefined}
                availableLimitMask={account ? availableLimitMask : undefined}
                setValue={setValue}
                isCreation={!account}
              />

              {/* Opção para compartilhar cartão com household compartilhada */}
              {account && isInPersonalHousehold && sharedHousehold && (
                <AccountSharingToggle
                  isSharing={isSharingAccount}
                  onToggle={setIsSharingAccount}
                  sharedHouseholdName={sharedHousehold.name}
                />
              )}

              <CreditCardModalFooter
                isEditing={!!account}
                isLoading={isSubmitting || isLoading}
                onCancel={onClose}
              />
            </form>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

