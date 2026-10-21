import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransactions } from '../context/TransactionsContext';
import { useI18n } from '../context/I18nContext';
import { useToastContext } from '../context/ToastContext';
import { useCurrency } from '../context/CurrencyContext';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { createSchemas, AccountFormData } from '../schemas';
import { Account } from '../types';
import { AccountType } from '../lib/enums';
import { getAccountTypeLabel } from '../constants/accountTypes';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useHouseholds } from '../hooks/api/useHouseholds';
import { useUpdateSharedAccountIds, useHouseholdMembers } from '../hooks/api/useHouseholds';
import { useAuthUser } from '../hooks/api/useAuth';
import {
  AccountModalHeader,
  AccountBasicFields,
  CreditCardFields,
  AccountSharingToggle,
  AccountModalFooter,
} from './accounts';

interface AccountModalProps {
  account: Account | null;
  onClose: () => void;
  defaultType?: AccountType;
}

export const AccountModal = ({ account, onClose, defaultType = AccountType.CHECKING }: AccountModalProps) => {
  const { addAccount, updateAccount, accounts } = useTransactions();
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const { success, error: showError } = useToastContext();
  const { accountSchema } = createSchemas(t);
  const { householdId: currentHouseholdId } = useDefaultHousehold();
  const { data: households } = useHouseholds();
  const { data: authUser } = useAuthUser();
  const updateSharedAccountIds = useUpdateSharedAccountIds();
  
  const currencyMask = useCurrencyMask();
  const creditLimitMask = useCurrencyMask();
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
  
  // Get current member's shared account IDs from shared household (even when we're in personal household)
  const { data: sharedHouseholdMembers } = useHouseholdMembers(sharedHousehold?.id || '');
  const currentMember = useMemo(() => {
    if (!sharedHouseholdMembers || !authUser?.id) return null;
    // Find current user in shared household members
    // m.userId is the user ID from the database (string)
    const member = sharedHouseholdMembers.find(m => m.userId === authUser.id);
    return member || null;
  }, [sharedHouseholdMembers, authUser?.id]);
  
  const isAccountShared = useMemo(() => {
    if (!account?.id || !currentMember) return false;
    // Check if account ID is in sharedAccountIds array
    const sharedIds = currentMember.sharedAccountIds;
    if (!sharedIds || !Array.isArray(sharedIds)) return false;
    return sharedIds.includes(account.id);
  }, [account?.id, currentMember]);
  
  const [isSharingAccount, setIsSharingAccount] = useState(isAccountShared);
  
  // Sync isSharingAccount when account or currentMember changes
  useEffect(() => {
    setIsSharingAccount(isAccountShared);
  }, [isAccountShared]);
  
  // Filtrar contas bancárias para vincular (excluir cartões de crédito e investimentos)
  const bankAccountsForLinking = useMemo(() => {
    return accounts.filter(acc => 
      acc.id !== account?.id && // Não pode vincular a si mesmo
      acc.type !== AccountType.CREDIT && 
      acc.type !== AccountType.INVESTMENT
    );
  }, [accounts, account?.id]);

  // Account type options with i18n
  const accountTypeOptions = useMemo(() => {
    return Object.values(AccountType).map(type => ({
      value: type,
      label: getAccountTypeLabel(type, t as unknown as Record<string, string>),
    }));
  }, [t]);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: '',
      type: defaultType,
      balance: 0,
      color: '#3b82f6',
      creditLimit: undefined,
      dueDay: undefined,
      closingDay: undefined,
      linkedAccountId: undefined,
    },
  });

  const { handleSubmit, reset, setValue, watch, register } = form;
  const { errors: _errors, isSubmitting } = form.formState;

  useEffect(() => {
    if (account) {
      reset({
        name: account.name,
        type: account.type as AccountType, // Ensure it's the enum value
        balance: account.balance,
        color: account.color,
        creditLimit: account.creditLimit || undefined,
        dueDay: account.dueDay || undefined,
        closingDay: account.closingDay || undefined,
        linkedAccountId: account.linkedAccountId || undefined,
      });
      currencyMask.setValue(account.balance || 0);
      creditLimitMask.setValue(account.creditLimit || 0);
    } else {
      reset({
        name: '',
        type: defaultType,
        balance: 0,
        color: '#3b82f6',
        creditLimit: undefined,
        dueDay: undefined,
        closingDay: undefined,
        linkedAccountId: undefined,
      });
      currencyMask.setValue(0);
      creditLimitMask.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account?.id, defaultType, reset]);

  const onSubmit = async (data: AccountFormData) => {
    if (isLoading) {
      return; // Prevenir múltiplos submits
    }
    
    setIsLoading(true);
    
    try {
      // Preparar dados da conta
      // Na edição, só enviamos nome, cor, closingDay e linkedAccountId (tipo não pode ser alterado)
      const accountData = account?.id
        ? {
            name: data.name,
            color: data.color,
            // Campos específicos de cartão de crédito podem ser editados
            ...(account.type === AccountType.CREDIT && {
              closingDay: data.closingDay,
              linkedAccountId: data.linkedAccountId || null,
            }),
            // Não enviar type, balance, creditLimit ou dueDay na edição
          }
        : {
            name: data.name,
            type: data.type as AccountType,
            color: data.color,
            balance: data.balance || 0,
            // Incluir campos específicos de cartão de crédito
            ...(data.type === AccountType.CREDIT && {
              creditLimit: data.creditLimit,
              dueDay: data.dueDay,
              closingDay: data.closingDay,
              linkedAccountId: data.linkedAccountId || undefined,
            }),
          };
          
          // Se linkedAccountId foi fornecido, herdar a cor do banco vinculado
          if (data.type === AccountType.CREDIT && data.linkedAccountId && !data.color) {
            const linkedAccount = bankAccountsForLinking.find(acc => acc.id === data.linkedAccountId);
            if (linkedAccount?.color) {
              accountData.color = linkedAccount.color;
            }
          }

      if (account?.id) {
        // Na edição, não enviamos balance (usa Partial)
        await updateAccount(account.id, accountData as Partial<Account>);
        
        // Atualizar compartilhamento se necessário
        if (isInPersonalHousehold && sharedHousehold && account.id && isSharingAccount !== isAccountShared) {
          const currentSharedIds = currentMember?.sharedAccountIds || [];
          let newSharedIds: string[];
          
          if (isSharingAccount) {
            // Adicionar conta aos compartilhados
            newSharedIds = [...currentSharedIds, account.id];
          } else {
            // Remover conta dos compartilhados
            newSharedIds = currentSharedIds.filter(id => id !== account.id);
          }
          
          await updateSharedAccountIds.mutateAsync({
            householdId: sharedHousehold.id,
            sharedAccountIds: newSharedIds,
          });
        }
        
        success(t.accountUpdated);
        onClose();
      } else {
        // Na criação, balance é obrigatório
        await addAccount(accountData as Omit<Account, 'id' | 'userId'>);
        success(t.accountCreated);
        // Nota: Para compartilhar após criação, o usuário precisa editar a conta depois
        onClose();
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t.errorSavingAccount;
      showError(errorMessage);
      // Não fechar o modal em caso de erro para o usuário poder corrigir
    } finally {
      setIsLoading(false);
    }
  };

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        {/* Modal Card */}
        <div className="relative w-full sm:w-96 max-w-md p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
          <AccountModalHeader isEditing={!!account} onClose={onClose} />

          <form onSubmit={handleSubmit(
            (data) => {
              onSubmit(data);
            },
            (errors) => {
              // Mostrar primeiro erro encontrado
              const firstError = Object.values(errors)[0];
              if (firstError) {
                showError(firstError.message || t.formValidationError);
              }
            }
          )} className="space-y-4">
            <AccountBasicFields
              account={account}
              form={form}
              currencyMask={currencyMask}
              accountTypeOptions={accountTypeOptions}
              defaultType={defaultType}
              baseCurrency={baseCurrency || 'BRL'}
              setValue={setValue}
            />

            {/* Campos de cartão de crédito */}
            {(!account && watch('type') === AccountType.CREDIT) || (account?.type === AccountType.CREDIT) ? (
              <CreditCardFields
                account={account}
                form={form}
                creditLimitMask={creditLimitMask}
                bankAccountsForLinking={bankAccountsForLinking}
                setValue={setValue}
                isCreation={!account}
              />
            ) : null}

            {/* Campo de cor */}
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

            {/* Opção para compartilhar conta com household compartilhada */}
            {account && isInPersonalHousehold && sharedHousehold && (
              <AccountSharingToggle
                isSharing={isSharingAccount}
                onToggle={setIsSharingAccount}
                sharedHouseholdName={sharedHousehold.name}
              />
            )}

            <AccountModalFooter
              isEditing={!!account}
              isLoading={isSubmitting || isLoading}
              onCancel={onClose}
            />
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

