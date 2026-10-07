import { useState, useMemo, useCallback, useEffect } from 'react';
import type React from 'react';
import { useTransactions as useTransactionsContext } from '../context/TransactionsContext';
import { useCommandMenu } from '../context/CommandMenuContext';
import { useCurrency } from '../context/CurrencyContext';
import { useI18n } from '../context/I18nContext';
import { useSearchParams } from 'react-router-dom';
import { formatCurrency, formatDate, parseDateFromAPI } from '../utils/format';
import { useTransactions, useLoadMoreTransactions } from '../hooks/api/useTransactions';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { useAuthUser } from '../hooks/api/useAuth';
import { useHouseholds } from '../hooks/api/useHouseholds';
import { type DateRange } from '../components/DateRangePicker';
import { CategoryType } from '../lib/enums';
import { 
  Plus, Download,
  Wallet, Briefcase, TrendingUp, ShoppingBag, Home, DollarSign,
  UtensilsCrossed, Car, House, Heart, GraduationCap, Film, Shirt,
  Zap, CreditCard, ShoppingCart, ShoppingBasket, Utensils, Droplet, Pill, MoreHorizontal, Circle,
  ArrowLeftRight
} from 'lucide-react';
import TransactionModal from '../components/TransactionModal';
import DivideTransactionDialog from '../components/people/DivideTransactionDialog';
import { canWritePeople } from '../utils/people';
import { usePeopleAvailable } from '../utils/peopleAvailability';
import ConfirmModal from '../components/ConfirmModal';
import { Transaction } from '../types';
import { PageButton } from '../components/PageButton';
import { CategoryName, getCategoryIconName, getCategoryDisplayName, TransactionType } from '../lib/enums';
import { TransactionFilters, TransactionList } from '../components/transactions';

// Helper function to get icon component for category (supports enum or CUSTOM:uuid)
const getCategoryIcon = (categoryName: string | undefined, customCategories?: { id: string; name: string; icon?: string | null }[]) => {
  if (!categoryName) return Circle;
  const iconName = getCategoryIconName(categoryName, customCategories);
  const iconMap: Record<string, React.ComponentType<any>> = {
    Wallet, Briefcase, TrendingUp, ShoppingBag, Home, DollarSign,
    UtensilsCrossed, Car, House, Heart, GraduationCap, Film, Shirt,
    Zap, CreditCard, ShoppingCart, ShoppingBasket, Utensils, Droplet, Pill, MoreHorizontal, Circle,
    ArrowLeftRight
  };
  
  return iconMap[iconName] || Circle;
};

const Transactions = () => {
  const { exportToCSV, accounts, deleteTransaction, updateTransaction, customCategories } = useTransactionsContext();
  const { baseCurrency } = useCurrency();
  const { t, locale } = useI18n();
  const { registerHandler, unregisterHandler } = useCommandMenu();
  const { householdId, household } = useDefaultHousehold();
  // Splitting writes shares: EDITOR or more, and a server that has the people routes.
  const peopleAvailable = usePeopleAvailable();
  const canSplitShares = canWritePeople(household) && peopleAvailable;
  const { data: authUser } = useAuthUser();
  const { data: households } = useHouseholds();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [sharingTransaction, setSharingTransaction] = useState<Transaction | null>(null);
  const [searchInput, setSearchInput] = useState<string>(''); // Input value (updates immediately)
  const [searchTerm, setSearchTerm] = useState<string>(''); // Debounced value (used in query)
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null }); // Applied date range (used in query)
  const [tempDateRange, setTempDateRange] = useState<DateRange>({ startDate: null, endDate: null }); // Temporary date range (while user is selecting)
  // cursor não é mais necessário no estado - é gerenciado pelo React Query cache
  const [activeTab, setActiveTab] = useState<'transactions' | 'scheduled'>('transactions');
  
  // Inicializar filtro de tipo a partir dos query params
  const getInitialTypeFilter = () => {
    const typeParam = searchParams.get('type');
    // Aceitar tanto valores do enum quanto valores em português (para compatibilidade)
    if (typeParam === TransactionType.INCOME || typeParam === 'receita' || typeParam?.toLowerCase() === 'income') {
      return TransactionType.INCOME;
    }
    if (typeParam === TransactionType.EXPENSE || typeParam === 'despesa' || typeParam?.toLowerCase() === 'expense') {
      return TransactionType.EXPENSE;
    }
    return 'todos';
  };
  
  const [typeFilter, setTypeFilter] = useState<string>(getInitialTypeFilter);
  const [categoryFilter, setCategoryFilter] = useState<string>('todas');
  const [paidFilter, setPaidFilter] = useState<string>('todos');
  
  // Resetar filtro de categoria quando o idioma mudar (para evitar incompatibilidade)
  useEffect(() => {
    setCategoryFilter('todas');
  }, [locale]);
  
  // Build query params for API
  // Note: cursor is NOT included here - it's only used in loadMore mutation
  const transactionsQuery = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const params: any = {
      householdId,
      limit: 25,
      // cursor is NOT included here - it's only used in loadMore mutation
      ...(searchTerm && { search: searchTerm }),
      ...(typeFilter !== 'todos' && { type: typeFilter === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE }),
      ...(categoryFilter && categoryFilter !== 'todas' && categoryFilter !== '' && { categoryName: categoryFilter }),
    };

    if (activeTab === 'scheduled') {
      // Próximos agendamentos: apenas transações com data > hoje
      params.startDate = tomorrow;
    } else {
      // Transações: usa o intervalo do usuário ou, se vazio, só até hoje (evita futuras em primeiro)
      if (dateRange.startDate) params.startDate = dateRange.startDate;
      if (dateRange.endDate) params.endDate = dateRange.endDate;
      if (!dateRange.startDate && !dateRange.endDate) params.endDate = today;
    }
    return params;
  }, [householdId, dateRange, searchTerm, typeFilter, categoryFilter, activeTab]);
  
  // Fetch transactions with pagination
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactions(transactionsQuery);
  const loadMoreMutation = useLoadMoreTransactions();
  
  // Memoizar função de carregar mais para evitar re-renders desnecessários
  const handleLoadMore = useCallback(async () => {
    // Verificar se já está carregando ou se não há mais dados
    if (loadMoreMutation.isPending) {
      return;
    }
    
    if (!transactionsData?.pagination?.nextCursor) {
      return;
    }
    
    const nextCursor = transactionsData.pagination.nextCursor;
    
    // Usar os mesmos parâmetros da query original, apenas adicionando o cursor
    // Isso garante que a query key corresponda exatamente
    const params: any = {
      ...transactionsQuery,
      cursor: nextCursor,
    };
    
    try {
      await loadMoreMutation.mutateAsync(params);
    } catch (error) {
      console.error('[Transactions] Erro ao carregar mais transações:', error);
    }
  }, [
    transactionsData?.pagination?.nextCursor,
    transactionsQuery,
    loadMoreMutation,
  ]);
  
  // Convert backend transactions to frontend format
  const transactions = useMemo(() => {
    if (!transactionsData?.data) return [];
    return transactionsData.data
      .map((t: { id: string; description: string; amount: number | string; categoryName?: string; type?: string; date: string | Date; paid: boolean; accountId?: string; fromAccountId?: string; toAccountId?: string; relatedEntityId?: string; recurringTransactionId?: string; attachmentUrl?: string; installmentId?: string; installmentNumber?: number; totalInstallments?: number; notes?: string; isSplit?: boolean; splits?: Array<{ userId: string; amount: number | string; accountId?: string }> }) => {
        // Check if it's a transfer or allocation - these should not appear in income/expense calculations
        if (t.type === 'TRANSFER' || t.type === 'ALLOCATION') {
          // Parse and validate date
          let parsedDate: Date;
          try {
            parsedDate = parseDateFromAPI(t.date);
            if (isNaN(parsedDate.getTime())) {
              return null;
            }
          } catch (error) {
            return null;
          }
          
          // For transfers and allocations, use the categoryName from backend (should be TRANSFER or ALLOCATION)
          let categoryName: CategoryName;
          if (t.categoryName) {
            categoryName = t.categoryName as CategoryName;
          } else {
            // Legacy fallback: infer from type
            categoryName = t.type === 'TRANSFER' ? CategoryName.TRANSFER : CategoryName.ALLOCATION;
          }
          
          return {
            id: t.id,
            description: t.description,
            amount: typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount),
            type: t.type === 'TRANSFER' ? TransactionType.TRANSFER : TransactionType.ALLOCATION,
            category: getCategoryDisplayName(categoryName as string, t as Record<string, string>, customCategories),
            categoryName: categoryName as string,
            date: parsedDate,
            paid: t.paid,
            accountId: t.accountId,
            fromAccountId: t.fromAccountId,
            toAccountId: t.toAccountId,
            relatedEntityId: t.relatedEntityId,
            recurringTransactionId: t.recurringTransactionId,
            attachmentUrl: t.attachmentUrl,
            installmentId: t.installmentId,
            installmentNumber: t.installmentNumber,
            totalInstallments: t.totalInstallments,
            notes: t.notes,
            isSplit: (t as any).isSplit || false,
            splits: (t as any).splits ? (t as any).splits.map((split: any) => ({
              userId: split.userId,
              amount: typeof split.amount === 'number' ? split.amount : Number(split.amount),
              accountId: split.accountId || undefined,
            })) : undefined,
          };
        }

        // Use type from backend first, fallback to categoryName inference
        let transactionType: TransactionType;
        if (t.type === 'INCOME' || t.type === 'EXPENSE' || t.type === 'TRANSFER' || t.type === 'ALLOCATION') {
          transactionType = t.type as TransactionType;
        } else {
          // Fallback: infer from categoryName if type is not available
          const incomeCategories = ['SALARY', 'FREELANCE', 'INVESTMENTS', 'SALES', 'RENTAL_INCOME', 'OTHER_INCOME'];
          const isIncome = t.categoryName && incomeCategories.includes(t.categoryName);
          transactionType = isIncome ? TransactionType.INCOME : TransactionType.EXPENSE;
        }

        let parsedDate: Date;
        try {
          parsedDate = parseDateFromAPI(t.date);
          if (isNaN(parsedDate.getTime())) return null;
        } catch {
          return null;
        }

        const catName = t.categoryName || 'OTHER_EXPENSES';
        return {
          id: t.id,
          description: t.description,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount),
          type: transactionType,
          category: getCategoryDisplayName(catName, t as Record<string, string>, customCategories),
          categoryName: catName,
          date: parsedDate,
          paid: t.paid,
          accountId: t.accountId,
          fromAccountId: t.fromAccountId,
          toAccountId: t.toAccountId,
          relatedEntityId: t.relatedEntityId,
          recurringTransactionId: t.recurringTransactionId,
          attachmentUrl: t.attachmentUrl,
          installmentId: t.installmentId,
          installmentNumber: t.installmentNumber,
          totalInstallments: t.totalInstallments,
          notes: t.notes,
          isSplit: (t as any).isSplit || false,
          splits: (t as any).splits ? (t as any).splits.map((split: any) => ({
            userId: split.userId,
            amount: typeof split.amount === 'number' ? split.amount : Number(split.amount),
            accountId: split.accountId || undefined,
          })) : undefined,
        };
      })
      .filter((t): t is Transaction => t !== null);
  }, [transactionsData, customCategories]);
  
  const loading = transactionsLoading;
  
  // Debounce do search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      // Reset cache quando search muda - o React Query vai fazer nova query sem cursor
    }, 300); // 300ms delay

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Atualizar filtro quando os query params mudarem (vindo de navegação externa)
  useEffect(() => {
    const typeParam = searchParams.get('type');
    // Aceitar tanto valores do enum quanto valores em português (para compatibilidade)
    if (typeParam === TransactionType.INCOME || typeParam === 'receita' || typeParam?.toLowerCase() === 'income') {
      setTypeFilter(TransactionType.INCOME);
    } else if (typeParam === TransactionType.EXPENSE || typeParam === 'despesa' || typeParam?.toLowerCase() === 'expense') {
      setTypeFilter(TransactionType.EXPENSE);
    } else if (!typeParam && searchParams.has('type')) {
      // Se há query param 'type' mas é vazio, reseta para 'todos'
      setTypeFilter('todos');
    }

    // Ler datas dos query params (formato ISO: YYYY-MM-DD)
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    
    // Só atualizar se houver pelo menos uma data nos query params
    if (startDateParam || endDateParam) {
      try {
        const newDateRange: DateRange = {
          startDate: startDateParam ? new Date(startDateParam + 'T00:00:00') : null,
          endDate: endDateParam ? new Date(endDateParam + 'T23:59:59') : null,
        };
        // Validar se as datas são válidas
        if ((!startDateParam || !isNaN(newDateRange.startDate!.getTime())) && 
            (!endDateParam || !isNaN(newDateRange.endDate!.getTime()))) {
          setDateRange(newDateRange);
          setTempDateRange(newDateRange);
        }
      } catch (error) {
        // Ignorar erros de parsing de data
        console.error('Erro ao parsear datas dos query params:', error);
      }
    }
  }, [searchParams]);
  
  // Atualizar query params quando o filtro mudar manualmente
  const handleTypeFilterChange = (value: string) => {
    setTypeFilter(value);
    if (value === TransactionType.INCOME || value === TransactionType.EXPENSE) {
      setSearchParams({ type: value }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; transactionId: string | null }>({
    isOpen: false,
    transactionId: null,
  });

  useEffect(() => {
    const handleNewTransaction = () => {
      setEditingTransaction(null);
      setIsModalOpen(true);
    };
    registerHandler('newTransaction', handleNewTransaction);
    
    // Escuta eventos do onboarding
    const handleTriggerCommand = (event: CustomEvent) => {
      if (event.detail?.handlerKey === 'newTransaction') {
        handleNewTransaction();
        // Verifica se há um tipo de transação pendente no sessionStorage
        const pendingType = sessionStorage.getItem('pendingTransactionType');
        if (pendingType && (pendingType === TransactionType.INCOME || pendingType === TransactionType.EXPENSE)) {
          sessionStorage.removeItem('pendingTransactionType');
          // Define o tipo no modal através de um evento customizado
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('setTransactionType', { detail: { type: pendingType } }));
          }, 100);
        }
      }
    };
    
    window.addEventListener('triggerCommandHandler', handleTriggerCommand as EventListener);
    
    // Verifica se há um tipo de transação pendente no sessionStorage ao carregar a página
    const pendingType = sessionStorage.getItem('pendingTransactionType');
    if (pendingType && (pendingType === TransactionType.INCOME || pendingType === TransactionType.EXPENSE)) {
      sessionStorage.removeItem('pendingTransactionType');
      // Aguarda um pouco para garantir que o modal está pronto
      setTimeout(() => {
        handleNewTransaction();
        // Define o tipo no modal através de um evento customizado
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('setTransactionType', { detail: { type: pendingType } }));
        }, 100);
      }, 100);
    }
    
    return () => {
      unregisterHandler('newTransaction');
      window.removeEventListener('triggerCommandHandler', handleTriggerCommand as EventListener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(transaction => {
      // Busca expandida - busca em todos os campos visíveis no card
      // Usa searchInput para filtro local imediato (não espera debounce)
      // Nota: A busca ainda é feita no frontend porque o backend só busca em description e notes
      const searchValue = searchInput || searchTerm; // Usa input se houver, senão usa o termo com debounce
      if (searchValue) {
        const searchLower = searchValue.toLowerCase().trim();
        const descriptionMatch = transaction.description?.toLowerCase().includes(searchLower) || false;
        const categoryMatch = transaction.category?.toLowerCase().includes(searchLower) || false;
        // Busca no tipo traduzido
        const typeLabel = transaction.type === TransactionType.INCOME 
          ? t.income 
          : transaction.type === TransactionType.TRANSFER || transaction.type === TransactionType.ALLOCATION
          ? t.operation
          : t.expense;
        const typeMatch = typeLabel.toLowerCase().includes(searchLower);
        
        // Busca por valor numérico (mais robusta)
        let amountMatch = false;
        if (searchLower.match(/[\d.,]/)) {
          // Remove caracteres não numéricos exceto ponto e vírgula
          const numericSearch = searchLower.replace(/[^\d.,]/g, '');
          if (numericSearch) {
            // Normaliza vírgula para ponto
            const normalizedSearch = numericSearch.replace(',', '.');
            const searchAmount = parseFloat(normalizedSearch);
            
            if (!isNaN(searchAmount) && isFinite(searchAmount)) {
              // Busca no valor absoluto da transação
              const transactionAmount = Math.abs(transaction.amount || 0);
              // Compara valores (com tolerância para diferenças de formatação)
              amountMatch = Math.abs(transactionAmount - searchAmount) < 0.01 ||
                           transactionAmount.toString().includes(normalizedSearch) ||
                           transactionAmount.toString().includes(numericSearch);
            }
          }
        }
        
        // Busca no valor formatado da moeda (fallback)
        if (!amountMatch) {
          const amountFormatted = formatCurrency(Math.abs(transaction.amount || 0), baseCurrency);
          amountMatch = amountFormatted.toLowerCase().includes(searchLower) || 
                       amountFormatted.replace(/[^\d,.-]/g, '').includes(searchLower);
        }
        
        // Busca na data formatada
        const dateFormatted = formatDate(transaction.date);
        const dateMatch = dateFormatted.toLowerCase().includes(searchLower);
        
        const matchesSearch = descriptionMatch || categoryMatch || typeMatch || amountMatch || dateMatch;
        if (!matchesSearch) return false;
      }
      
      // Filtro de tipo ainda é feito no frontend porque pode haver TRANSFER/ALLOCATION que não são filtrados pelo backend quando typeFilter é 'todos'
      const matchesType = typeFilter === 'todos' || transaction.type === typeFilter;
      
      // Filtro de categoria agora é feito no backend, então não precisa filtrar aqui
      // Mas mantemos a verificação para garantir compatibilidade
      
      // Filtro de paid ainda é feito no frontend (backend não suporta ainda)
      const matchesPaid = 
        paidFilter === 'todos' || 
        (paidFilter === 'paid' && transaction.paid !== false) || 
        (paidFilter === 'pending' && transaction.paid === false);
      return matchesType && matchesPaid;
    });
  }, [transactions, searchInput, searchTerm, typeFilter, paidFilter, baseCurrency, t]);

  // Função para obter chave de data (YYYY-MM-DD)
  const getDateKey = (date: Date): string => {
    try {
      const d = date instanceof Date ? date : (typeof date === 'string' ? parseDateFromAPI(date) : new Date(date));
      
      // Validate date
      if (isNaN(d.getTime())) {
        // Return a fallback date key
        const fallback = new Date();
        const year = fallback.getFullYear();
        const month = String(fallback.getMonth() + 1).padStart(2, '0');
        const day = String(fallback.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch (error) {
      // Return a fallback date key
      const fallback = new Date();
      const year = fallback.getFullYear();
      const month = String(fallback.getMonth() + 1).padStart(2, '0');
      const day = String(fallback.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };


  // Agrupar transações por data
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    
    // Filter out transactions with invalid dates first
    const validTransactions = filteredTransactions.filter(transaction => {
      if (!transaction.date) return false;
      const date = transaction.date instanceof Date ? transaction.date : (typeof transaction.date === 'string' ? parseDateFromAPI(transaction.date) : new Date(transaction.date));
      return !isNaN(date.getTime());
    });
    
    validTransactions.forEach(transaction => {
      const dateKey = getDateKey(transaction.date);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(transaction);
    });

    // Ordenar transações dentro de cada grupo por data (mais recente primeiro)
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
    });

    // Retornar grupos ordenados por data (mais recente primeiro)
    return Object.entries(groups)
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .map(([dateKey, transactions]) => {
        // Parse dateKey (format: YYYY-MM-DD) to Date object
        try {
          const date = parseDateFromAPI(dateKey);
          // Validate parsed date
          if (isNaN(date.getTime())) {
            return null;
          }
          return {
            dateKey,
            date,
            transactions
          };
        } catch (error) {
          return null;
        }
      })
      .filter((group): group is { dateKey: string; date: Date; transactions: Transaction[] } => group !== null);
  }, [filteredTransactions]);

  // Determine personal household (oldest by createdAt)
  const personalHouseholdId = useMemo(() => {
    if (!households || households.length === 0) return null;
    const sorted = [...households].sort((a, b) => {
      const dateA = new Date(a.createdAt || a.joinedAt || 0).getTime();
      const dateB = new Date(b.createdAt || b.joinedAt || 0).getTime();
      return dateA - dateB; // Oldest first
    });
    return sorted[0]?.id || null;
  }, [households]);

  // Check if current household is personal household
  const isPersonalHousehold = useMemo(() => {
    return personalHouseholdId !== null && householdId === personalHouseholdId;
  }, [personalHouseholdId, householdId]);

  // Helper function to check if transaction is shared and user participated
  const isTransactionSharedAndUserParticipated = useCallback((transaction: Transaction): boolean => {
    if (!isPersonalHousehold) return false; // Only check when in personal household
    if (!transaction.isSplit || !transaction.splits || transaction.splits.length === 0) return false;
    if (!authUser?.id) return false;
    // Check if current user has a split in this transaction
    return transaction.splits.some(split => split.userId === authUser.id);
  }, [isPersonalHousehold, authUser?.id]);

  const handleEdit = (transaction: Transaction): void => {
    // Prevent editing shared transactions when in personal household
    if (isTransactionSharedAndUserParticipated(transaction)) {
      // Show view mode instead
      setViewingTransaction(transaction);
      setEditingTransaction(null);
      setIsModalOpen(true);
      return;
    }
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string): void => {
    const transaction = transactions.find(t => t.id === id);
    // Prevent deleting shared transactions when in personal household
    if (transaction && isTransactionSharedAndUserParticipated(transaction)) {
      return; // Do nothing - menu should be disabled, but add safety check
    }
    setConfirmModal({ isOpen: true, transactionId: id });
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (confirmModal.transactionId) {
      await deleteTransaction(confirmModal.transactionId);
      setConfirmModal({ isOpen: false, transactionId: null });
    }
  };

  const handleMarkAsPaid = async (id: string, paid: boolean): Promise<void> => {
    const transaction = transactions.find(t => t.id === id);
    if (!transaction) return;
    // Prevent marking shared transactions as paid/pending when in personal household
    if (isTransactionSharedAndUserParticipated(transaction)) {
      return; // Do nothing - menu should be disabled, but add safety check
    }
    await updateTransaction(id, { paid });
  };

  // Helper function to format transaction description
  const formatTransactionDescription = useCallback((transaction: Transaction): string => {
    // For transfers, ALWAYS format as "Movimentação Financeira: Origem → Destino"
    if (transaction.type === TransactionType.TRANSFER) {
      const transferLabel = t.transfer || 'Movimentação Financeira';
      let accountNames = '';
      
      // First priority: get account names from IDs
      if (transaction.fromAccountId && transaction.toAccountId) {
        const fromAccount = accounts.find(a => a.id === transaction.fromAccountId);
        const toAccount = accounts.find(a => a.id === transaction.toAccountId);
        if (fromAccount && toAccount) {
          accountNames = `${fromAccount.name} → ${toAccount.name}`;
        }
      }
      
      // Second priority: extract from description if we don't have account names
      if (!accountNames) {
        const desc = transaction.description || '';
        // Remove any existing prefix
        const cleanDesc = desc.replace(/^(?:Transfer|Movimentação\s+Financeira):\s*/i, '').trim();
        
        // Try to extract "X → Y" format
        const arrowMatch = cleanDesc.match(/(.+?)\s*→\s*(.+)/);
        if (arrowMatch) {
          accountNames = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
        } else if (cleanDesc) {
          accountNames = cleanDesc;
        }
      }
      
      // ALWAYS return with prefix "Movimentação Financeira: " for transfers
      // Force the prefix even if it already exists to ensure consistency
      if (accountNames) {
        // Remove any existing prefix to avoid duplication
        const cleanNames = accountNames.replace(/^(?:Transfer|Movimentação\s+Financeira):\s*/i, '').trim();
        return `${transferLabel}: ${cleanNames}`;
      }
      return `${transferLabel}:`;
    }
    
    // For allocations, ALWAYS format as "Alocação: Origem → Destino"
    if (transaction.type === TransactionType.ALLOCATION) {
      const allocationLabel = t.categoryALLOCATION || 'Alocação';
      let accountNames = '';
      
      // First priority: get account names from IDs
      if (transaction.relatedEntityId && transaction.accountId) {
        const account = accounts.find(a => a.id === transaction.accountId);
        const creditCard = accounts.find(a => a.id === transaction.relatedEntityId);
        if (account && creditCard) {
          // Check if amount is negative (deallocation)
          const isDeallocation = transaction.amount < 0;
          if (isDeallocation) {
            // Deallocation: credit card → account
            accountNames = `${creditCard.name} → ${account.name}`;
          } else {
            // Allocation: account → credit card
            accountNames = `${account.name} → ${creditCard.name}`;
          }
        }
      }
      
      // Second priority: extract from description if we don't have account names
      if (!accountNames) {
        const desc = transaction.description || '';
        // Remove any existing prefix
        const cleanDesc = desc.replace(/^(?:Allocation|Deallocation|Alocar\s+Saldo|Desalocar\s+Saldo|Alocação):\s*/i, '').trim();
        
        // Try to extract "X → Y" format
        const arrowMatch = cleanDesc.match(/(.+?)\s*→\s*(.+)/);
        if (arrowMatch) {
          accountNames = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
        } else if (cleanDesc) {
          accountNames = cleanDesc;
        }
      }
      
      // ALWAYS return with prefix "Alocação: " for allocations
      // Force the prefix even if it already exists to ensure consistency
      if (accountNames) {
        // Remove any existing prefix to avoid duplication
        const cleanNames = accountNames.replace(/^(?:Allocation|Deallocation|Alocar\s+Saldo|Desalocar\s+Saldo|Alocação):\s*/i, '').trim();
        return `${allocationLabel}: ${cleanNames}`;
      }
      return `${allocationLabel}:`;
    }
    
    // For other transactions, use the description as is, or show "Sem descrição" if empty
    return transaction.description || t.noDescription || '';
  }, [accounts, t]);

  const handleAdd = (): void => {
    setEditingTransaction(null);
    setIsModalOpen(true);
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in">
      <div className="mb-12 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="min-w-0 flex-shrink">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900 dark:text-white">
            {t.transactions}
          </h1>
          <p className="mt-1 text-sm font-medium text-gray-500 dark:text-gray-300">
            {t.income} & {t.expense}
          </p>
        </div>
        {/* Desktop: todos os botões */}
        <div className="hidden sm:flex gap-2 items-center w-auto flex-shrink-0">
          <PageButton
            onClick={exportToCSV}
            variant="secondary"
            icon={Download}
            aria-label={t.exportCSV}
          >
            CSV
          </PageButton>
          <PageButton
            onClick={handleAdd}
            variant="primary"
            icon={Plus}
            aria-label={t.newTransaction}
          >
            {t.newTransaction}
          </PageButton>
        </div>
        {/* Mobile: layout customizado */}
        <div className="flex flex-col gap-2 w-full sm:hidden">
          <PageButton
            onClick={handleAdd}
            variant="primary"
            icon={Plus}
            aria-label={t.newTransaction}
          >
            {t.newTransaction}
          </PageButton>
          <div className="flex gap-2">
            <PageButton
              onClick={exportToCSV}
              variant="secondary"
              icon={Download}
              aria-label={t.exportCSV}
              className="flex-1"
            >
              CSV
            </PageButton>
          </div>
        </div>
      </div>

      {/* Abas: Transações | Próximos agendamentos */}
      <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
        <button
          type="button"
          onClick={() => { if (!loading) setActiveTab('transactions'); }}
          disabled={loading}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'transactions'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {t.transactions}
        </button>
        <button
          type="button"
          onClick={() => { if (!loading) setActiveTab('scheduled'); }}
          disabled={loading}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'scheduled'
              ? 'border-primary-500 text-primary-600 dark:text-primary-400'
              : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {t.upcomingScheduled}
        </button>
      </div>

      {/* Filtros */}
      <TransactionFilters
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        dateRange={dateRange}
        tempDateRange={tempDateRange}
        onDateRangeChange={setTempDateRange}
        onDateRangeApply={(range) => {
          setDateRange(range);
          setTempDateRange(range);
          // Reset cache quando date range muda - o React Query vai fazer nova query
        }}
        typeFilter={typeFilter}
        onTypeFilterChange={handleTypeFilterChange}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={(value) => {
          if (!value || value === t.all) setCategoryFilter('todas');
          else setCategoryFilter(value);
          // O filtro de categoria agora é feito no backend - React Query fará refetch automaticamente
        }}
        paidFilter={paidFilter}
        onPaidFilterChange={setPaidFilter}
        activeTab={activeTab}
        householdId={householdId ?? undefined}
        t={t}
        locale={locale}
        onClearFilters={() => {
          setSearchInput('');
          setSearchTerm('');
          handleTypeFilterChange('todos');
          setCategoryFilter('todas');
          setPaidFilter('todos');
          setDateRange({ startDate: null, endDate: null });
          // Reset cache quando filtros são limpos - o React Query vai fazer nova query
        }}
        hasActiveFilters={!!(searchInput || typeFilter !== 'todos' || categoryFilter !== 'todas' || paidFilter !== 'todos' || dateRange.startDate || dateRange.endDate)}
        disabled={loading}
      />

      {/* Lista de transações */}
      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-gray-800 shadow rounded-md overflow-hidden">
              <div className="px-4 sm:px-6 py-3 bg-gray-50 dark:bg-gray-700/50">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
              </div>
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {[1, 2].map((j) => (
                  <li key={j} className="px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                      </div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <TransactionList
          groupedTransactions={groupedTransactions}
          accounts={accounts}
          baseCurrency={baseCurrency}
          customCategories={customCategories}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onMarkAsPaid={handleMarkAsPaid}
          onView={(transaction) => {
            setViewingTransaction(transaction);
            setEditingTransaction(null);
            setIsModalOpen(true);
          }}
          onSplitShares={canSplitShares ? setSharingTransaction : undefined}
          formatTransactionDescription={formatTransactionDescription}
          getCategoryIcon={getCategoryIcon}
          isTransactionSharedAndUserParticipated={isTransactionSharedAndUserParticipated}
          hasMore={transactionsData?.pagination?.hasMore || false}
          isLoadingMore={loadMoreMutation.isPending}
          totalCount={transactionsData?.pagination?.total}
          currentCount={transactions.length}
          onLoadMore={handleLoadMore}
          t={t}
        />
      )}

      {isModalOpen && (
        <TransactionModal
          transaction={editingTransaction || viewingTransaction}
          onClose={() => {
            setIsModalOpen(false);
            setEditingTransaction(null);
            setViewingTransaction(null);
          }}
          defaultAccountId={null}
          readOnly={!!viewingTransaction}
        />
      )}

      {sharingTransaction?.id && (
        <DivideTransactionDialog
          open
          onClose={() => setSharingTransaction(null)}
          householdId={householdId ?? undefined}
          transaction={{ id: sharingTransaction.id, description: sharingTransaction.description, amount: sharingTransaction.amount }}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, transactionId: null })}
        onConfirm={handleConfirmDelete}
        title={t.delete}
        message={`${t.delete} ${t.transaction?.toLowerCase() || t.transactions.toLowerCase()}?`}
        variant="danger"
      />
    </div>
  );
};

export default Transactions;

