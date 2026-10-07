import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTransactions } from '../context/TransactionsContext';
import { useCurrencyMask } from '../hooks/useCurrencyMask';
import { useToastContext } from '../context/ToastContext';
import { useI18n } from '../context/I18nContext';
import { useCurrency } from '../context/CurrencyContext';
import { formatCurrency } from '../utils/format';
import { fillTemplate } from '../utils/fillTemplate';
import { amountChanged, recurrenceUpdatedAmount, showsFollowLastHint } from '../utils/recurringFollow';
import { Transaction } from '../types';
import { createSchemas, TransactionFormData } from '../schemas';
import { CategoryType, CategoryName, getCategoriesByType, getCategoryNameFromDisplay, AccountType, TransactionType } from '../lib/enums';
import { getAvailableBalance } from '../utils/accountBalance';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useAvailableAccounts, useAccounts, type Account as AccountWithPersonal } from '../hooks/api/useAccounts';
import { useAuth } from '../context/AuthContext';
import { useAuthUser } from '../hooks/api/useAuth';
import { useHouseholds, useHouseholdMembers, type HouseholdMember } from '../hooks/api/useHouseholds';
import {
  TransactionModalHeader,
  TransactionTypeSelector,
  TransferFormFields,
  TransactionBasicFields,
  SplitTransactionForm,
  RecurringTransactionFields,
  InstallmentsField,
  TransactionModalFooter,
  AccountField,
} from './transactions';

interface TransactionModalProps {
  transaction: Transaction | null;
  onClose: () => void;
  defaultAccountId?: string | null;
  defaultPaid?: boolean;
  readOnly?: boolean;
}

const TransactionModal = ({ transaction, onClose, defaultAccountId, defaultPaid, readOnly = false }: TransactionModalProps) => {
  const { addTransaction, updateTransaction, createInstallments, accounts: contextAccounts, addRecurringTransaction, createTransfer, transactions: knownTransactions, recurringTransactions } = useTransactions();
  const { success, error: showError } = useToastContext();
  const { t } = useI18n();
  const { baseCurrency } = useCurrency();
  const currencyMask = useCurrencyMask();
  const { transactionSchema } = createSchemas(t);
  const { householdId, household: currentHousehold } = useDefaultHousehold();
  const { currentUser } = useAuth();
  const { data: authUser } = useAuthUser();

  // Check if we're in a shared household (not personal)
  // A shared household is any household that is not the oldest one (personal is oldest)
  const { data: allHouseholds } = useHouseholds();
  const isSharedHousehold = useMemo(() => {
    if (!allHouseholds || allHouseholds.length === 0 || !currentHousehold) return false;
    // Personal household is the oldest (first by createdAt)
    const sortedHouseholds = [...allHouseholds].sort((a, b) => 
      new Date(a.createdAt || a.joinedAt || 0).getTime() - new Date(b.createdAt || b.joinedAt || 0).getTime()
    );
    const personalHousehold = sortedHouseholds[0];
    return personalHousehold?.id !== currentHousehold.id;
  }, [allHouseholds, currentHousehold]);

  // Use available accounts endpoint when in shared household, regular accounts otherwise
  const { data: availableAccountsData } = useAvailableAccounts(
    householdId || '',
    false
  );
  const { data: regularAccountsData } = useAccounts(
    { householdId: householdId || '' }
  );

  // Determine which accounts to use
  // In shared household, use available accounts (includes personal if allowed)
  // In personal household, use regular accounts
  const accounts = useMemo(() => {
    if (isSharedHousehold && availableAccountsData?.accounts) {
      return availableAccountsData.accounts;
    }
    if (!isSharedHousehold && regularAccountsData?.accounts) {
      return regularAccountsData.accounts;
    }
    // Fallback to context accounts
    return contextAccounts || [];
  }, [isSharedHousehold, availableAccountsData, regularAccountsData, contextAccounts]);

  // Note: isAccountsLoading is available if needed in the future
  // const isAccountsLoading = isSharedHousehold ? availableAccountsLoading : regularAccountsLoading;
  
  
  // Estado para controlar se é recorrente
  const [isRecurring, setIsRecurring] = useState(false);
  
  // Estados para campos de recorrência
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'>('monthly');
  const [recurringStartDate, setRecurringStartDate] = useState<Date>(new Date());
  const [recurringEndDate, setRecurringEndDate] = useState<Date | undefined>(undefined);
  const [recurringNextDueDate, setRecurringNextDueDate] = useState<Date>(new Date());

  // Estados para divisão de despesas (splits)
  const [isSplit, setIsSplit] = useState(false);
  const [splits, setSplits] = useState<Array<{ userId: string; amount: number; accountId?: string }>>([]);
  // Erros de validação de saldo para cada split
  const [splitBalanceErrors, setSplitBalanceErrors] = useState<Record<string, string>>({});
  
  // Ref para rastrear se já dividimos automaticamente (para evitar recalcular quando valor muda)
  const hasAutoSplit = useRef(false);
  const lastMemberCount = useRef(0);
  const recalculateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Buscar membros da household (para splits)
  const { data: householdMembers } = useHouseholdMembers(householdId || '');

  // Função para calcular próxima data de vencimento baseada na frequência
  const calculateNextDueDate = useCallback((startDate: Date, frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'): Date => {
    const date = new Date(startDate);
    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + 1);
        return date;
      case 'weekly':
        date.setDate(date.getDate() + 7);
        return date;
      case 'biweekly':
        date.setDate(date.getDate() + 14);
        return date;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        return date;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        return date;
      default:
        date.setMonth(date.getMonth() + 1);
        return date;
    }
  }, []);

  // Função auxiliar para obter contas disponíveis para um membro e retornar accountId se houver apenas uma
  const getDefaultAccountIdForMember = useCallback((memberUserId: string, isCurrentUserMember: boolean): string | undefined => {
    const availableAccountsForMember = (accounts as AccountWithPersonal[]).filter((account: AccountWithPersonal) => {
      if (isCurrentUserMember) {
        // Para o usuário atual, mostrar todas as contas disponíveis
        return true;
      } else {
        // Para outros membros, mostrar apenas contas pessoais deles ou compartilhadas
        return account.accountOwnerId === memberUserId || !account.isPersonal;
      }
    });

    // Se houver apenas uma conta disponível, retornar o ID dela
    if (availableAccountsForMember.length === 1) {
      return availableAccountsForMember[0].id || undefined;
    }

    return undefined;
  }, [accounts]);


  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
    watch,
    control,
  } = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      description: '',
      amount: 0,
      type: TransactionType.EXPENSE,
      category: '',
      date: new Date(),
      paid: true,
      accountId: '',
      installments: 1,
      fromAccountId: '',
      toAccountId: '',
    },
  });

  const transactionDate = watch('date');
  const transactionType = watch('type');
  const transactionCategory = watch('category');
  const selectedAccountId = watch('accountId');
  const transactionAmount = watch('amount') || 0;
  // A recurrence that follows the last amount takes the value of its most recent occurrence: say so while editing it.
  const amountHint = useMemo(
    () => (transaction && showsFollowLastHint(transaction, recurringTransactions, knownTransactions, new Date()) ? t.recurringFollowHint : null),
    [transaction, recurringTransactions, knownTransactions, t],
  );

  // Detectar se estamos no contexto de cartões de crédito
  const isCreditCardContext = useMemo(() => {
    if (defaultAccountId) {
      const account = accounts.find(a => a.id === defaultAccountId);
      return account?.type === AccountType.CREDIT;
    }
    return false;
  }, [defaultAccountId, accounts]);

  // Verificar se a conta selecionada é cartão de crédito
  const isSelectedAccountCreditCard = useMemo(() => {
    if (selectedAccountId) {
      const account = accounts.find(a => a.id === selectedAccountId);
      return account?.type === AccountType.CREDIT;
    }
    return isCreditCardContext;
  }, [selectedAccountId, accounts, isCreditCardContext]);

  // Filtrar contas baseado no contexto
  // Incluir CHECKING, SAVINGS, CREDIT, CASH (não INVESTMENT)
  const availableAccounts = useMemo(() => {
    if (isCreditCardContext) {
      // Se for contexto de cartão, mostrar apenas cartões de crédito
      return accounts.filter(account => 
        account.type === AccountType.CREDIT
      );
    } else {
      // Caso contrário, mostrar todas as contas (bancárias, cartões de crédito, dinheiro), exceto investimentos
      // O campo de parcelas será controlado pela conta selecionada
      return accounts.filter(account => 
        account.type !== AccountType.INVESTMENT
      );
    }
  }, [accounts, isCreditCardContext]);

  // Verificar se há contas disponíveis para mostrar warning
  const hasNoAccountsAvailable = availableAccounts.length === 0 && !isCreditCardContext;

  // Forçar tipo EXPENSE quando for contexto de cartão de crédito
  useEffect(() => {
    if (isCreditCardContext && transactionType !== TransactionType.EXPENSE) {
      setValue('type', TransactionType.EXPENSE, { shouldValidate: true });
    }
  }, [isCreditCardContext, transactionType, setValue]);

  // Ajustar tipo automaticamente quando categoria muda (apenas se não for cartão de crédito)
  useEffect(() => {
    if (transactionCategory && !transaction && !isCreditCardContext) {
      const categoryName = getCategoryNameFromDisplay(transactionCategory, t as unknown as Record<string, string>);
      if (categoryName) {
        const incomeCategories = getCategoriesByType(CategoryType.INCOME);
        const expectedType = incomeCategories.includes(categoryName as CategoryName) ? TransactionType.INCOME : TransactionType.EXPENSE;
        if (transactionType !== expectedType) {
          setValue('type', expectedType, { shouldValidate: true });
        }
      }
    }
  }, [transactionCategory, transactionType, transaction, setValue, t, isCreditCardContext]);

  // Limpar categoria se não for compatível com o tipo selecionado
  // No contexto de cartão de crédito, apenas despesas são permitidas
  useEffect(() => {
    if (transactionCategory && transactionType && !transaction) {
      const categoryName = getCategoryNameFromDisplay(transactionCategory, t as unknown as Record<string, string>);
      if (categoryName) {
        const incomeCategories = getCategoriesByType(CategoryType.INCOME);
        const expenseCategories = getCategoriesByType(CategoryType.EXPENSE);
        const isIncomeCategory = incomeCategories.includes(categoryName as CategoryName);
        const isExpenseCategory = expenseCategories.includes(categoryName as CategoryName);
        
        // Se for cartão de crédito, limpar categoria se for receita
        if (isCreditCardContext && isIncomeCategory) {
          setValue('category', '', { shouldValidate: true });
        } else if (!isCreditCardContext) {
          // Para outros contextos, validar normalmente
          if ((transactionType === TransactionType.INCOME && !isIncomeCategory) || 
              (transactionType === TransactionType.EXPENSE && !isExpenseCategory)) {
            setValue('category', '', { shouldValidate: true });
          }
        }
      }
    }
  }, [transactionType, transactionCategory, transaction, setValue, t, isCreditCardContext]);

  // Limpar apenas os campos do "outro" tipo ao mudar: em TRANSFER limpamos accountId/category;
  // em INCOME/EXPENSE limpamos from/to. Não limpar from/to quando é TRANSFER para não apagar
  // os valores ao abrir uma transferência para edição.
  useEffect(() => {
    if (transactionType === TransactionType.TRANSFER) {
      setValue('accountId', '', { shouldValidate: false });
      setValue('category', '', { shouldValidate: false });
    } else {
      setValue('fromAccountId', '', { shouldValidate: false });
      setValue('toAccountId', '', { shouldValidate: false });
    }
  }, [transactionType, setValue]);

  // Atualizar data de início da recorrência quando a data da transação mudar
  useEffect(() => {
    if (isRecurring && !transaction && transactionDate) {
      const date = transactionDate instanceof Date ? transactionDate : new Date(transactionDate);
      setRecurringStartDate(date);
      setRecurringNextDueDate(calculateNextDueDate(date, recurringFrequency));
    }
  }, [transactionDate, isRecurring, transaction, recurringFrequency, calculateNextDueDate]);

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    const recalcRef = recalculateTimeoutRef;
    // Prevenir scroll do body quando modal estiver aberto
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
      // Limpar timeout ao desmontar
      const timeoutId = recalcRef.current;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [onClose]);

  // Escuta eventos para definir o tipo de transação (usado pelo onboarding)
  // Não permite alteração se for contexto de cartão de crédito
  useEffect(() => {
    const handleSetTransactionType = (event: CustomEvent) => {
      // Não permitir alteração de tipo se for cartão de crédito
      if (isCreditCardContext) {
        return;
      }
      if (event.detail?.type && (event.detail.type === TransactionType.INCOME || event.detail.type === TransactionType.EXPENSE)) {
        setValue('type', event.detail.type);
      }
    };
    
    window.addEventListener('setTransactionType', handleSetTransactionType as EventListener);
    
    return () => {
      window.removeEventListener('setTransactionType', handleSetTransactionType as EventListener);
    };
  }, [setValue, isCreditCardContext]);

  useEffect(() => {
    if (transaction) {
      const amount = transaction.amount || 0;
      const tDate = transaction.date instanceof Date ? transaction.date : new Date(transaction.date);
      const accountId = transaction.accountId || '';
      
      // Se for contexto de cartão de crédito, forçar tipo EXPENSE
      // Se a transação for INCOME ou TRANSFER, não permitir edição (será bloqueada)
      const transactionType = isCreditCardContext 
        ? TransactionType.EXPENSE 
        : (transaction.type || TransactionType.EXPENSE);
      
      reset({
        description: transaction.description || '',
        amount: amount,
        type: transactionType,
        category: transaction.categoryName ?? transaction.category ?? '',
        date: tDate,
        paid: transaction.paid !== undefined ? transaction.paid : true,
        accountId: accountId,
        installments: transaction.totalInstallments || 1,
        fromAccountId: transaction.fromAccountId ?? '',
        toAccountId: transaction.toAccountId ?? '',
      });
      currencyMask.setValue(amount);
      setValue('amount', amount);
      
      // Se for cartão de crédito e a transação for INCOME ou TRANSFER, limpar categoria
      if (isCreditCardContext && (transaction.type === TransactionType.INCOME || transaction.type === TransactionType.TRANSFER)) {
        setValue('category', '', { shouldValidate: true });
      }
    } else {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const defaultDate = new Date();
      // Se a data padrão for hoje ou passado, assume como pago (a menos que defaultPaid seja fornecido)
      const isPaidDefault = defaultPaid !== undefined ? defaultPaid : defaultDate >= today;
      
      setIsRecurring(false);
      setRecurringFrequency('monthly');
      setRecurringStartDate(defaultDate);
      setRecurringEndDate(undefined);
      setRecurringNextDueDate(calculateNextDueDate(defaultDate, 'monthly'));
      // Limpar splits quando for nova transação
      setIsSplit(false);
      setSplits([]);
      
      // Selecionar primeira conta disponível se não tiver defaultAccountId
      let selectedAccountId = defaultAccountId || '';
      if (!selectedAccountId && availableAccounts.length > 0) {
        selectedAccountId = availableAccounts[0].id || '';
      }

      // Se for contexto de cartão de crédito, sempre usar EXPENSE
      const defaultType = isCreditCardContext ? TransactionType.EXPENSE : TransactionType.EXPENSE;
      
      reset({
        description: '',
        amount: 0,
        type: defaultType,
        category: '',
        date: defaultDate,
        paid: isPaidDefault,
        accountId: selectedAccountId,
        installments: 1,
        fromAccountId: '',
        toAccountId: '',
      });
      currencyMask.setValue('');
      setValue('amount', 0);
      // Garantir que a conta seja definida mesmo se não houver defaultAccountId
      if (selectedAccountId && !defaultAccountId) {
        setValue('accountId', selectedAccountId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transaction?.id, defaultAccountId, defaultPaid, reset, setValue, availableAccounts]);

  // Dividir automaticamente quando isSplit é ativado pela primeira vez ou quando o número de membros muda
  // Não recalcular quando o valor muda para não sobrescrever edições manuais
  useEffect(() => {
    if (!isSplit) {
      // Resetar flags quando isSplit é desativado
      hasAutoSplit.current = false;
      lastMemberCount.current = 0;
      return;
    }

    if (transactionType === TransactionType.EXPENSE && isSharedHousehold && householdMembers && householdMembers.length > 0 && transactionAmount > 0) {
      // Only include EDITOR and OWNER members for splits
      const activeMembers = householdMembers.filter((m: HouseholdMember) => 
        m.user && m.user.email && (m.role === 'EDITOR' || m.role === 'OWNER')
      );
      const currentMemberCount = activeMembers.length;
      
      // Só recalcular automaticamente se:
      // 1. Não foi dividido automaticamente ainda (primeira vez que isSplit é ativado)
      // 2. O número de membros mudou desde a última divisão automática
      // 3. Não há splits ainda (primeira vez)
      // IMPORTANTE: NÃO recalcular quando o valor muda - deixar usuário editar manualmente ou usar botão "Dividir igualmente"
      const needsRecalculation = !hasAutoSplit.current || 
        currentMemberCount !== lastMemberCount.current ||
        splits.length === 0 ||
        splits.length !== currentMemberCount;
      
      if (activeMembers.length > 0 && needsRecalculation) {
        // Dividir igualmente entre todos os membros ativos
        const amountPerPerson = transactionAmount / activeMembers.length;
        // Arredondar para 2 casas decimais, mas ajustar o último para garantir que a soma seja exata
        const roundedAmount = Math.round(amountPerPerson * 100) / 100;
        const newSplits = activeMembers.map((member: HouseholdMember, index: number) => {
          // Preservar accountId se já existir, senão usar default se houver apenas uma conta
          const existingSplit = splits.find(s => s.userId === member.userId);
          const isCurrentUserMember = member.userId === (authUser?.id || currentUser?.uid);
          const defaultAccountId = existingSplit?.accountId || getDefaultAccountIdForMember(member.userId, isCurrentUserMember);
          
          // O último membro recebe o restante para garantir que a soma seja exata
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
        setSplits(newSplits);
        hasAutoSplit.current = true;
        lastMemberCount.current = currentMemberCount;
      }
    } else if (transactionType !== TransactionType.EXPENSE || !isSharedHousehold) {
      // Limpar splits se não for mais EXPENSE em shared household
      setSplits([]);
      hasAutoSplit.current = false;
      lastMemberCount.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSplit, transactionType, isSharedHousehold, householdMembers, getDefaultAccountIdForMember, authUser?.id, currentUser?.uid]); // NÃO incluir transactionAmount e splits para não recalcular quando valor mudar (evitar sobrescrever edições manuais)

  // Atualizar splits quando transaction é carregada (se já tiver splits)
  // Este deve rodar PRIMEIRO para carregar os splits da transação
  useEffect(() => {
    if (transaction) {
      if (transaction.isSplit && transaction.splits && transaction.splits.length > 0) {
        setIsSplit(true);
        // Carregar splits e preencher accountId padrão para membros que não têm conta selecionada
        const splitsWithDefaults = transaction.splits.map(split => {
          if (split.accountId) {
            // Se já tem accountId, manter
            return split;
          }
          // Se não tem accountId, tentar encontrar o membro e usar default se houver apenas uma conta
          const member = householdMembers?.find((m: HouseholdMember) => m.userId === split.userId);
          if (member) {
            const isCurrentUserMember = member.userId === (authUser?.id || currentUser?.uid);
            const defaultAccountId = getDefaultAccountIdForMember(split.userId, isCurrentUserMember);
            return {
              ...split,
              accountId: defaultAccountId,
            };
          }
          return split;
        });
        setSplits(splitsWithDefaults);
      } else {
        setIsSplit(false);
        setSplits([]);
      }
    } else {
      // Limpar splits quando não há transação (novo formulário)
      setIsSplit(false);
      setSplits([]);
    }
  }, [transaction, householdMembers, authUser?.id, currentUser?.uid, getDefaultAccountIdForMember]);

  // Desativar splits se não for mais EXPENSE em shared household
  // Este deve rodar DEPOIS para validar se os splits ainda são válidos
  useEffect(() => {
    // Só desativar se já tiver splits ativos E não for mais válido
    // Não desativar quando está carregando uma transação que já tem splits
    if (isSplit && transaction && transaction.isSplit) {
      // Se a transação já tem splits, manter ativo mesmo se as condições mudarem temporariamente
      return;
    }
    if (isSplit && (transactionType !== TransactionType.EXPENSE || !isSharedHousehold)) {
      setIsSplit(false);
      setSplits([]);
      setSplitBalanceErrors({});
    }
  }, [isSplit, transactionType, isSharedHousehold, transaction]);

  // Observar valor de 'paid' para validar saldos
  const transactionPaid = watch('paid');

  // Validar saldo de cada split quando splits, paid ou contas mudarem
  useEffect(() => {
    if (!isSplit || !isSharedHousehold || transactionType !== TransactionType.EXPENSE) {
      setSplitBalanceErrors({});
      return;
    }

    if (!transactionPaid || splits.length === 0) {
      setSplitBalanceErrors({});
      return;
    }

    const errors: Record<string, string> = {};
    for (const split of splits) {
      if (!split.accountId) {
        continue;
      }

      const splitAccount = accounts.find(a => a.id === split.accountId) as AccountWithPersonal | undefined;
      if (!splitAccount) {
        continue;
      }

      // Cartões de crédito não têm saldo, então não validar saldo para eles
      if (splitAccount.type === AccountType.CREDIT) {
        continue;
      }

      // Validar saldo disponível da conta selecionada para este split
      const availableBalance = getAvailableBalance(splitAccount);
      if (split.amount > availableBalance) {
        errors[split.userId] = t.splitInsufficientBalance
          .replace('{{available}}', formatCurrency(availableBalance, baseCurrency))
          .replace('{{amount}}', formatCurrency(split.amount, baseCurrency));
      }
    }

    setSplitBalanceErrors(errors);
  }, [splits, transactionPaid, accounts, householdMembers, isSplit, isSharedHousehold, transactionType, baseCurrency, t]);

  const onSubmit = async (data: TransactionFormData, shouldCreateNew = false) => {
    if (readOnly) {
      return; // Não permitir submit em modo read-only
    }
    try {
      // Handle transfers separately
      if (data.type === TransactionType.TRANSFER) {
        if (!data.fromAccountId || !data.toAccountId) {
          showError(t.fromAccountRequired);
          return;
        }
        if (data.fromAccountId === data.toAccountId) {
          showError(t.sameAccountError);
          return;
        }
        
        // Validar saldo disponível na conta de origem e buscar nomes das contas
        const fromAccount = accounts.find(a => a.id === data.fromAccountId);
        const toAccount = accounts.find(a => a.id === data.toAccountId);
        
        if (fromAccount) {
          const availableBalance = getAvailableBalance(fromAccount);
          if (data.amount > availableBalance) {
            showError(t.insufficientAvailableBalance);
            return;
          }
        }
        
        // Se não houver descrição, criar automaticamente: "Banco origem → Banco destino"
        const fromAccountName = fromAccount?.name || t.fromAccountDefault;
        const toAccountName = toAccount?.name || t.toAccountDefault;
        const transferDescription = data.description || `${fromAccountName} → ${toAccountName}`;
        
        await createTransfer({
          fromAccountId: data.fromAccountId,
          toAccountId: data.toAccountId,
          amount: data.amount,
          description: transferDescription,
          date: data.date,
        });
        success(t.transferCreated);
        if (!shouldCreateNew) {
          onClose();
        } else {
          // Reset form for new transaction (transfer)
          const defaultDate = new Date();
          setIsRecurring(false);
          setRecurringFrequency('monthly');
          setRecurringStartDate(defaultDate);
          setRecurringEndDate(undefined);
          setRecurringNextDueDate(calculateNextDueDate(defaultDate, 'monthly'));
          setIsSplit(false);
          setSplits([]);
          setSplitBalanceErrors({});
          reset({
            description: '',
            amount: 0,
            type: TransactionType.TRANSFER,
            category: '',
            date: defaultDate,
            paid: true,
            accountId: '',
            fromAccountId: '',
            toAccountId: '',
            installments: 1,
          });
          currencyMask.setValue('');
          setValue('amount', 0);
          setValue('fromAccountId', '');
          setValue('toAccountId', '');
        }
        return;
      }

      // Validar que há uma conta selecionada para transações INCOME/EXPENSE
      if (!data.accountId || data.accountId === '') {
        showError(t.accountOrCardRequired);
        return;
      }

      // Validar splits se isSplit estiver ativo
      if (isSplit && data.type === TransactionType.EXPENSE && isSharedHousehold) {
        if (!splits || splits.length === 0) {
          showError(t.pleaseSplitExpense);
          return;
        }
        // Validar que a soma dos splits seja igual ao valor total (com tolerância de 1 centavo)
        const totalSplits = splits.reduce((sum, split) => sum + split.amount, 0);
        const tolerance = 0.01;
        if (Math.abs(totalSplits - data.amount) > tolerance) {
          showError(`${t.splitSumMustEqualTotal} (${formatCurrency(totalSplits, baseCurrency)}) ${t.of} (${formatCurrency(data.amount, baseCurrency)}).`);
          return;
        }

        // Validar saldo individual de cada membro quando a transação está marcada como paga
        // Os erros já são validados em tempo real via useEffect, então apenas verificar se há erros
        if (data.paid && Object.keys(splitBalanceErrors).length > 0) {
          // Não mostrar toast, os erros já estão sendo exibidos nos campos
          return;
        }
      } else {
        // Validar saldo disponível para despesas pagas (quando não é split)
        if (data.type === TransactionType.EXPENSE && data.paid && data.accountId) {
          const account = accounts.find(a => a.id === data.accountId);
          if (account) {
            // Não validar saldo para cartões de crédito (eles têm limite, não saldo)
            const isCreditCard = account.type === AccountType.CREDIT;
            if (!isCreditCard) {
              const availableBalance = getAvailableBalance(account);
              if (data.amount > availableBalance) {
                showError(t.insufficientAvailableBalance);
                return;
              }
            }
          }
        }
      }

      const transactionData = {
        description: data.description || '', // Garantir que seja string, não undefined
        amount: data.amount,
        type: data.type,
        category: data.category || undefined,
        date: data.date,
        // Credit card purchases always settle the limit immediately — never
        // mark them as pending, otherwise the "Atrasado" tag triggers even
        // when the purchase date falls inside the invoice period.
        paid: isCreditCardContext ? true : data.paid,
        accountId: data.accountId || undefined,
        ...(isSplit && data.type === TransactionType.EXPENSE && isSharedHousehold && splits.length > 0 && {
          isSplit: true,
          splits: splits,
        }),
      };

      if (transaction) {
        if (transaction.id) {
          // Only send the amount when the user changed it: a recurrence that follows the last amount adopts the amount an
          // update carries, so editing just a note or the paid mark must not make it adopt the stored one.
          const { amount: editedAmount, ...withoutAmount } = transactionData;
          const outcome = await updateTransaction(transaction.id, amountChanged(transaction.amount, editedAmount) ? transactionData : withoutAmount);
          success(t.transactionUpdated);
          // The server moved the amount of the recurrence this occurrence belongs to: say so.
          const recurrenceAmount = recurrenceUpdatedAmount(outcome?.recurringUpdated);
          if (recurrenceAmount !== null) success(fillTemplate(t.recurringFollowUpdated, { amount: formatCurrency(recurrenceAmount, baseCurrency) }));
        }
        if (!shouldCreateNew) {
          onClose();
        }
      } else if (isRecurring) {
        // Criar transação recorrente
        await addRecurringTransaction({
          ...transactionData,
          category: transactionData.category || '', // Garantir que category seja string
          frequency: recurringFrequency,
          startDate: recurringStartDate,
          endDate: recurringEndDate,
          nextDueDate: recurringNextDueDate,
          isActive: true,
        });
        success(t.transactionCreated);
        if (!shouldCreateNew) {
          onClose();
        } else {
          // Reset form for new recurring transaction
          const defaultDate = new Date();
          setIsRecurring(false);
          setRecurringFrequency('monthly');
          setRecurringStartDate(defaultDate);
          setRecurringEndDate(undefined);
          setRecurringNextDueDate(calculateNextDueDate(defaultDate, 'monthly'));
          setIsSplit(false);
          setSplits([]);
          setSplitBalanceErrors({});
          let selectedAccountId = defaultAccountId || '';
          if (!selectedAccountId && availableAccounts.length > 0) {
            selectedAccountId = availableAccounts[0].id || '';
          }
          reset({
            description: '',
            amount: 0,
            type: isCreditCardContext ? TransactionType.EXPENSE : TransactionType.EXPENSE,
            category: '',
            date: defaultDate,
            paid: defaultDate >= new Date(new Date().setHours(0, 0, 0, 0)),
            accountId: selectedAccountId,
            fromAccountId: '',
            toAccountId: '',
            installments: 1,
          });
          currencyMask.setValue('');
          setValue('amount', 0);
        }
      } else if (data.installments > 1 && (data.type === TransactionType.INCOME || data.type === TransactionType.EXPENSE)) {
        // Criar parcelas (não permitido para transferências)
        await createInstallments(transactionData, data.installments);
        success(t.installmentsCreated);
        if (!shouldCreateNew) {
          onClose();
        } else {
          // Reset form for new installment transaction
          const defaultDate = new Date();
          setIsRecurring(false);
          setRecurringFrequency('monthly');
          setRecurringStartDate(defaultDate);
          setRecurringEndDate(undefined);
          setRecurringNextDueDate(calculateNextDueDate(defaultDate, 'monthly'));
          setIsSplit(false);
          setSplits([]);
          setSplitBalanceErrors({});
          let selectedAccountId = defaultAccountId || '';
          if (!selectedAccountId && availableAccounts.length > 0) {
            selectedAccountId = availableAccounts[0].id || '';
          }
          const defaultType = isCreditCardContext ? TransactionType.EXPENSE : TransactionType.EXPENSE;
          reset({
            description: '',
            amount: 0,
            type: defaultType,
            category: '',
            date: defaultDate,
            paid: defaultDate >= new Date(new Date().setHours(0, 0, 0, 0)),
            accountId: selectedAccountId,
            fromAccountId: '',
            toAccountId: '',
            installments: 1,
          });
          currencyMask.setValue('');
          setValue('amount', 0);
        }
      } else {
        // Criar transação simples
        await addTransaction(transactionData);
        success(t.transactionCreated);
        if (!shouldCreateNew) {
          onClose();
        } else {
          // Reset form for new transaction
          const defaultDate = new Date();
          setIsRecurring(false);
          setRecurringFrequency('monthly');
          setRecurringStartDate(defaultDate);
          setRecurringEndDate(undefined);
          setRecurringNextDueDate(calculateNextDueDate(defaultDate, 'monthly'));
          setIsSplit(false);
          setSplits([]);
          let selectedAccountId = defaultAccountId || '';
          if (!selectedAccountId && availableAccounts.length > 0) {
            selectedAccountId = availableAccounts[0].id || '';
          }
          const defaultType = isCreditCardContext ? TransactionType.EXPENSE : TransactionType.EXPENSE;
          reset({
            description: '',
            amount: 0,
            type: defaultType,
            category: '',
            date: defaultDate,
            paid: defaultDate >= new Date(new Date().setHours(0, 0, 0, 0)),
            accountId: selectedAccountId,
            fromAccountId: '',
            toAccountId: '',
            installments: 1,
          });
          currencyMask.setValue('');
          setValue('amount', 0);
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : t.error;
      showError(errorMessage);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 animate-fade-in transition-opacity duration-300 ease-out" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full sm:w-[450px] max-w-lg p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0 animate-slide-in-bottom">
          <TransactionModalHeader
            title={readOnly ? t.viewDetails : (transaction ? t.editTransaction : t.newTransaction)}
            onClose={onClose}
            readOnly={readOnly}
          />

          <form onSubmit={handleSubmit((data) => onSubmit(data, false))} className="space-y-4 min-w-0">
            {!isCreditCardContext && (
              <TransactionTypeSelector
                control={control}
                errors={errors}
                accounts={accounts}
                disabled={readOnly}
              />
            )}

            {transactionType === TransactionType.TRANSFER && (
              <TransferFormFields
                control={control}
                watch={watch}
                setValue={setValue}
                errors={errors}
                accounts={accounts}
                disabled={readOnly}
              />
            )}

            <TransactionBasicFields
              control={control}
              register={register}
              watch={watch}
              setValue={setValue}
              errors={errors}
              transactionType={transactionType}
              accounts={accounts}
              currencyMask={currencyMask}
              isCreditCardContext={isCreditCardContext}
              disabled={readOnly}
              householdId={householdId ?? undefined}
              amountHint={amountHint}
            />

            {transactionType === TransactionType.EXPENSE && isSharedHousehold && householdMembers && householdMembers.length > 1 && !readOnly && (
              <SplitTransactionForm
                isSplit={isSplit}
                onSplitChange={(newIsSplit) => {
                  setIsSplit(newIsSplit);
                  if (!newIsSplit) {
                    setSplits([]);
                    hasAutoSplit.current = false;
                    lastMemberCount.current = 0;
                  }
                }}
                splits={splits}
                onSplitsChange={setSplits}
                transactionAmount={transactionAmount}
                householdMembers={householdMembers}
                accounts={accounts as AccountWithPersonal[]}
                splitBalanceErrors={splitBalanceErrors}
                getDefaultAccountIdForMember={getDefaultAccountIdForMember}
                disabled={readOnly}
                currentUser={currentUser}
                authUser={authUser}
              />
            )}

            {transactionType !== TransactionType.TRANSFER && !isSplit && (
              <AccountField
                control={control}
                watch={watch}
                errors={errors}
                availableAccounts={availableAccounts as AccountWithPersonal[]}
                isCreditCardContext={isCreditCardContext}
                hasNoAccountsAvailable={hasNoAccountsAvailable}
                authUser={authUser}
                disabled={readOnly}
              />
            )}

            {!transaction && transactionType !== TransactionType.TRANSFER && isSelectedAccountCreditCard && (
              <>
                <InstallmentsField
                  register={register}
                  errors={errors}
                  disabled={readOnly}
                />

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isRecurring"
                    checked={isRecurring}
                    onChange={(e) => {
                      if (!readOnly) {
                        setIsRecurring(e.target.checked);
                        if (e.target.checked) {
                          const selectedDate = watch('date') || new Date();
                          setRecurringStartDate(selectedDate);
                          setRecurringNextDueDate(calculateNextDueDate(selectedDate, recurringFrequency));
                        }
                      }
                    }}
                    disabled={readOnly}
                    className={`h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded ${readOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                  />
                  <label htmlFor="isRecurring" className="ml-2 block text-sm text-gray-900 dark:text-gray-100 cursor-pointer">
                    {t.recurring}
                  </label>
                </div>

                <RecurringTransactionFields
                  isRecurring={isRecurring}
                  frequency={recurringFrequency}
                  startDate={recurringStartDate}
                  endDate={recurringEndDate}
                  nextDueDate={recurringNextDueDate}
                  onFrequencyChange={(freq) => {
                    setRecurringFrequency(freq);
                  }}
                  onStartDateChange={(date) => {
                    setRecurringStartDate(date);
                  }}
                  onEndDateChange={(date) => setRecurringEndDate(date)}
                  onNextDueDateChange={(date) => setRecurringNextDueDate(date)}
                  disabled={readOnly}
                />
              </>
            )}

            <TransactionModalFooter
              readOnly={readOnly}
              onClose={onClose}
              isSubmitting={isSubmitting}
              hasErrors={isSplit && Object.keys(splitBalanceErrors).length > 0}
              isUpdate={!!transaction}
              onSaveAndCreateNew={!transaction ? () => {
                handleSubmit((data) => onSubmit(data, true))();
              } : undefined}
            />
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default TransactionModal;
