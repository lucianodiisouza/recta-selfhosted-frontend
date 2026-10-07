import { useState, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { useTransactions } from "../context/TransactionsContext";
import { useCurrency } from "../context/CurrencyContext";
import { useI18n } from "../context/I18nContext";
import { useCommandMenu } from "../context/CommandMenuContext";
import { formatCurrency, parseDateFromAPI } from "../utils/format";
import { useTransactions as useTransactionsQuery, useLoadMoreTransactions } from "../hooks/api/useTransactions";
import { useDefaultHousehold } from "../hooks/useDefaultHousehold";
import { useAuthUser } from "../hooks/api/useAuth";
import { useHouseholdMembers } from "../hooks/api/useHouseholds";
import {
  Plus,
  Wallet,
  Calendar,
  Info,
  X,
  Circle,
  Briefcase,
  TrendingUp,
  ShoppingBag,
  Home,
  DollarSign,
  UtensilsCrossed,
  Car,
  House,
  Heart,
  GraduationCap,
  Film,
  Shirt,
  Zap,
  CreditCard,
  ShoppingCart,
  ShoppingBasket,
  Utensils,
  Droplet,
  Pill,
  MoreHorizontal,
  ArrowLeftRight,
} from "lucide-react";
import DeleteAccountModal from "../components/DeleteAccountModal";
import { AccountModal } from "../components/AccountModal";
import { AllocationModal } from "../components/AllocationModal";
import AdjustBalanceDialog from "../components/accounts/AdjustBalanceDialog";
import { TransactionList } from "../components/transactions/TransactionList";
import { AccountSelector, AccountSidebar } from "../components/accounts";
import { MonthNavigator } from "../components/shared";
import { Account, Transaction } from "../types";
import { PageHeader } from "../components/PageHeader";
import { PageButton } from "../components/PageButton";
import { AccountsSkeleton } from "../components/PageSkeletons";
import { getAccountBalance } from "../utils/accountBalance";
import TransactionModal from "../components/TransactionModal";
import ConfirmModal from "../components/ConfirmModal";
import { format } from "date-fns";
import { ptBR as ptBRLocale } from "date-fns/locale/pt-BR";
import { enUS as enUSLocale } from "date-fns/locale/en-US";
import { es as esLocale } from "date-fns/locale/es";
import { fr as frLocale } from "date-fns/locale/fr";
import { ru as ruLocale } from "date-fns/locale/ru";
import { ja as jaLocale } from "date-fns/locale/ja";
import { zhCN as zhCNLocale } from "date-fns/locale/zh-CN";
import { arSA as arSALocale } from "date-fns/locale/ar-SA";
import { CategoryName, getCategoryDisplayName, TransactionType, getCategoryIconName } from "../lib/enums";
import { EmptyState } from "../components/EmptyState";
import type React from "react";

const Accounts = () => {
  const { accounts: allAccounts, deleteAccount, deleteTransaction, updateTransaction, loading, customCategories } = useTransactions();
  const { baseCurrency } = useCurrency();
  const { t, locale } = useI18n();
  const { registerHandler, unregisterHandler } = useCommandMenu();
  const { householdId } = useDefaultHousehold();
  const { data: currentUser } = useAuthUser();
  const { data: householdMembers } = useHouseholdMembers(householdId || '');

  // Filtrar contas bancárias e investimentos (excluir apenas cartões de crédito)
  const accounts = useMemo(() => {
    if (!allAccounts || !Array.isArray(allAccounts)) {
      return [];
    }
    return allAccounts.filter(
      (account) => account && account.type !== "CREDIT"
    );
  }, [allAccounts]);

  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<Transaction | null>(null);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    account: Account | null;
  }>({
    isOpen: false,
    account: null,
  });
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    isOpen: boolean;
    transactionId: string | null;
  }>({
    isOpen: false,
    transactionId: null,
  });
  const [allocationModal, setAllocationModal] = useState<{
    isOpen: boolean;
    accountId: string | null;
    creditCardId: string | null;
    mode: "allocate" | "deallocate";
  }>({
    isOpen: false,
    accountId: null,
    creditCardId: null,
    mode: "allocate",
  });
  const [adjustAccountId, setAdjustAccountId] = useState<string | null>(null);
  const adjustAccount = adjustAccountId ? allAccounts?.find((a) => a.id === adjustAccountId) : undefined;
  const [isHelpModalOpen, setIsHelpModalOpen] = useState<boolean>(false);

  const currentLocale = useMemo(() => {
    switch (locale) {
      case "pt-BR":
        return ptBRLocale;
      case "es-ES":
        return esLocale;
      case "fr-FR":
        return frLocale;
      case "ru-RU":
        return ruLocale;
      case "ja-JP":
        return jaLocale;
      case "zh-CN":
        return zhCNLocale;
      case "ar-SA":
        return arSALocale;
      default:
        return enUSLocale;
    }
  }, [locale]);

  // Selecionar a primeira conta se nenhuma estiver selecionada
  useEffect(() => {
    if (accounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(accounts[0].id || null);
    }
  }, [accounts, selectedAccountId]);

  // Verificar se o usuário já viu o modal de ajuda
  useEffect(() => {
    const hasSeenHelp = localStorage.getItem('accountsHelpSeen');
    if (!hasSeenHelp) {
      setIsHelpModalOpen(true);
    }
  }, []);

  const handleCloseHelpModal = () => {
    setIsHelpModalOpen(false);
    localStorage.setItem('accountsHelpSeen', 'true');
  };

  const selectedAccount = useMemo(() => {
    return accounts.find((acc) => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  // Check if user is the owner of an account
  const isAccountOwner = useMemo(() => {
    if (!selectedAccount || !currentUser) return true; // Default to true if no account or user
    // If account is shared (isPersonal === true), check if current user is the owner
    if ((selectedAccount as any).isPersonal && (selectedAccount as any).accountOwnerId) {
      return (selectedAccount as any).accountOwnerId === currentUser.id;
    }
    // For household accounts, user is owner (can edit/delete)
    return true;
  }, [selectedAccount, currentUser]);

  // Get account owner info for display
  const accountOwnerInfo = useMemo(() => {
    if (!selectedAccount || !(selectedAccount as any).isPersonal || !(selectedAccount as any).accountOwnerId || !householdMembers) return null;
    const ownerMember = householdMembers.find(m => m.userId === (selectedAccount as any).accountOwnerId);
    return ownerMember?.user ? {
      name: ownerMember.user.displayName || ownerMember.user.email?.split('@')[0] || 'Usuário',
      email: ownerMember.user.email || '',
    } : null;
  }, [selectedAccount, householdMembers]);

  // Build query params for transactions
  const transactionsQuery = useMemo(() => {
    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    
    return {
      householdId,
      accountId: selectedAccountId || undefined,
      startDate: monthStart,
      endDate: monthEnd,
      limit: 25,
    };
  }, [householdId, selectedAccountId, selectedMonth]);

  // Fetch transactions with pagination
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactionsQuery(transactionsQuery);
  const loadMoreMutation = useLoadMoreTransactions();

  // Convert backend transactions to frontend format
  const transactions = useMemo(() => {
    if (!transactionsData?.data) return [];
    return transactionsData.data
      .map((t: any) => {
        // Check if it's a transfer or allocation
        if (t.type === 'TRANSFER' || t.type === 'ALLOCATION') {
          let parsedDate: Date;
          try {
            parsedDate = parseDateFromAPI(t.date);
            if (isNaN(parsedDate.getTime())) {
              return null;
            }
          } catch {
            return null;
          }
          
          let categoryName: CategoryName | string;
          if (t.categoryName) {
            categoryName = t.categoryName; // Can be CategoryName enum or "CUSTOM:uuid"
          } else {
            categoryName = t.type === 'TRANSFER' ? CategoryName.TRANSFER : CategoryName.ALLOCATION;
          }
          
          return {
            id: t.id,
            description: t.description,
            amount: typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount),
            type: t.type === 'TRANSFER' ? TransactionType.TRANSFER : TransactionType.ALLOCATION,
            category: getCategoryDisplayName(categoryName, t as Record<string, string>, customCategories),
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
          if (isNaN(parsedDate.getTime())) {
            return null;
          }
        } catch {
          return null;
        }
        
        return {
          id: t.id,
          description: t.description,
          amount: typeof t.amount === 'string' ? parseFloat(t.amount) : Number(t.amount),
          type: transactionType,
          category: t.categoryName ? getCategoryDisplayName(t.categoryName as CategoryName, t as Record<string, string>, customCategories) : '',
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
        };
      })
      .filter((t): t is Transaction => t !== null);
  }, [transactionsData, customCategories]);

  // Helper function to get icon component for category
  const getCategoryIcon = useCallback((categoryName: string | undefined, customCategories?: Array<{ id: string; name: string; icon?: string | null }>) => {
    if (!categoryName) return Circle;
    const iconName = getCategoryIconName(categoryName, customCategories);
    const iconMap: Record<string, React.ComponentType<any>> = {
      Wallet, Briefcase, TrendingUp, ShoppingBag, Home, DollarSign,
      UtensilsCrossed, Car, House, Heart, GraduationCap, Film, Shirt,
      Zap, CreditCard, ShoppingCart, ShoppingBasket, Utensils, Droplet, Pill, MoreHorizontal, Circle,
      ArrowLeftRight
    };
    return iconMap[iconName] || Circle;
  }, []);

  // Format transaction description
  const formatTransactionDescription = useCallback((transaction: Transaction): string => {
    if (transaction.type === TransactionType.TRANSFER) {
      const transferLabel = t.categoryTRANSFER || 'Transferência';
      let accountNames = '';
      
      if (transaction.fromAccountId && transaction.toAccountId) {
        const fromAccount = accounts.find(a => a.id === transaction.fromAccountId);
        const toAccount = accounts.find(a => a.id === transaction.toAccountId);
        if (fromAccount && toAccount) {
          accountNames = `${fromAccount.name} → ${toAccount.name}`;
        }
      }
      
      if (!accountNames) {
        const desc = transaction.description || '';
        const cleanDesc = desc.replace(/^(?:Transfer|Transferência|Movimentação\s+Financeira):\s*/i, '').trim();
        if (cleanDesc) {
          accountNames = cleanDesc;
        }
      }
      
      if (accountNames) {
        const cleanNames = accountNames.replace(/^(?:Transfer|Transferência|Movimentação\s+Financeira):\s*/i, '').trim();
        return `${transferLabel}: ${cleanNames}`;
      }
      return `${transferLabel}:`;
    }
    
    if (transaction.type === TransactionType.ALLOCATION) {
      const allocationLabel = t.categoryALLOCATION || 'Alocação';
      let accountNames = '';
      
      if (transaction.relatedEntityId && transaction.accountId) {
        const account = accounts.find(a => a.id === transaction.accountId);
        const creditCard = accounts.find(a => a.id === transaction.relatedEntityId);
        if (account && creditCard) {
          const isDeallocation = transaction.amount < 0;
          if (isDeallocation) {
            accountNames = `${creditCard.name} → ${account.name}`;
          } else {
            accountNames = `${account.name} → ${creditCard.name}`;
          }
        }
      }
      
      if (!accountNames) {
        const desc = transaction.description || '';
        const cleanDesc = desc.replace(/^(?:Allocation|Deallocation|Alocar\s+Saldo|Desalocar\s+Saldo|Alocação):\s*/i, '').trim();
        const arrowMatch = cleanDesc.match(/(.+?)\s*→\s*(.+)/);
        if (arrowMatch) {
          accountNames = `${arrowMatch[1].trim()} → ${arrowMatch[2].trim()}`;
        } else if (cleanDesc) {
          accountNames = cleanDesc;
        }
      }
      
      if (accountNames) {
        const cleanNames = accountNames.replace(/^(?:Allocation|Deallocation|Alocar\s+Saldo|Desalocar\s+Saldo|Alocação):\s*/i, '').trim();
        return `${allocationLabel}: ${cleanNames}`;
      }
      return `${allocationLabel}:`;
    }
    
    return transaction.description || t.noDescription || '';
  }, [accounts, t]);

  // Check if transaction is shared and user participated
  const isTransactionSharedAndUserParticipated = useCallback((_transaction: Transaction): boolean => {
    // For Accounts page, we don't need to check for shared transactions
    return false;
  }, []);

  // Get date key for grouping
  const getDateKey = useCallback((date: Date): string => {
    try {
      const d = date instanceof Date ? date : (typeof date === 'string' ? parseDateFromAPI(date) : new Date(date));
      if (isNaN(d.getTime())) {
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
      const fallback = new Date();
      const year = fallback.getFullYear();
      const month = String(fallback.getMonth() + 1).padStart(2, '0');
      const day = String(fallback.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }, []);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { [key: string]: Transaction[] } = {};
    
    const validTransactions = transactions.filter(transaction => {
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

    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB.getTime() - dateA.getTime();
      });
    });

    return Object.entries(groups)
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .map(([dateKey, transactions]) => {
        try {
          const date = parseDateFromAPI(dateKey);
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
  }, [transactions, getDateKey]);

  // Handle load more
  const handleLoadMore = useCallback(async () => {
    if (loadMoreMutation.isPending) {
      return;
    }
    
    if (!transactionsData?.pagination?.nextCursor) {
      return;
    }
    
    const nextCursor = transactionsData.pagination.nextCursor;
    
    const params: any = {
      ...transactionsQuery,
      cursor: nextCursor,
    };
    
    try {
      await loadMoreMutation.mutateAsync(params);
    } catch (error) {
      console.error('[Accounts] Erro ao carregar mais transações:', error);
    }
  }, [
    transactionsData?.pagination?.nextCursor,
    transactionsQuery,
    loadMoreMutation,
  ]);

  useEffect(() => {
    const handleNewAccount = () => {
      setEditingAccount(null);
      setIsModalOpen(true);
    };

    registerHandler("newAccount", handleNewAccount);

    const handleTriggerCommand = (event: CustomEvent) => {
      if (event.detail?.handlerKey === "newAccount") {
        handleNewAccount();
      }
    };

    window.addEventListener(
      "triggerCommandHandler",
      handleTriggerCommand as EventListener
    );

    return () => {
      unregisterHandler("newAccount");
      window.removeEventListener(
        "triggerCommandHandler",
        handleTriggerCommand as EventListener
      );
    };
  }, [registerHandler, unregisterHandler]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (isModalOpen) {
          setIsModalOpen(false);
          setEditingAccount(null);
        }
        if (isHelpModalOpen) {
          handleCloseHelpModal();
        }
      }
    };
    if (isModalOpen || isHelpModalOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isModalOpen, isHelpModalOpen]);

  useEffect(() => {
    if (!isModalOpen) return;
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isModalOpen]);

  // Calculate account balances (commented out - not currently used)
  // const accountBalances = useMemo(() => {
  //   const balances: Record<string, number> = {};
  //   accounts.forEach((account) => {
  //     const accountBalance = getAccountBalance(account);
  //     balances[account.id || ""] = accountBalance.totalBalance;
  //   });
  //   return balances;
  // }, [accounts]);

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, account) => {
      if (account.type === "CREDIT") {
        return sum;
      }
      const balances = getAccountBalance(account);
      return sum + balances.availableBalance;
    }, 0);
  }, [accounts]);

  const handleDelete = (account: Account) => {
    setDeleteModal({ isOpen: true, account });
  };

  const handleConfirmDelete = async (deleteTransactions: boolean) => {
    if (deleteModal.account?.id) {
      await deleteAccount(deleteModal.account.id, deleteTransactions);
      setDeleteModal({ isOpen: false, account: null });
      if (deleteModal.account.id === selectedAccountId) {
        setSelectedAccountId(null);
      }
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, transaction: Transaction) => {
    e.stopPropagation();
    setConfirmDeleteModal({
      isOpen: true,
      transactionId: transaction.id || null,
    });
  };

  const handleConfirmDeleteTransaction = async () => {
    if (!confirmDeleteModal.transactionId) return;
    try {
      await deleteTransaction(confirmDeleteModal.transactionId);
      setConfirmDeleteModal({ isOpen: false, transactionId: null });
    } catch (err: unknown) {
      // Error deleting transaction
    }
  };

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsTransactionModalOpen(true);
  };

  const handleNewTransaction = () => {
    if (!selectedAccountId && accounts.length > 0) {
      setSelectedAccountId(accounts[0].id || null);
    }
    setEditingTransaction(null);
    setIsTransactionModalOpen(true);
  };

  const handleMarkAsPaid = async (id: string, paid: boolean): Promise<void> => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      await updateTransaction(id, { paid });
    }
  };

  const handleMonthChange = (month: Date) => setSelectedMonth(month);

  if (loading) {
    return <AccountsSkeleton />;
  }

  if (accounts.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 dashboard-fade-in">
        <PageHeader title={t.accounts} description={t.accountsDescription}>
          <PageButton
            onClick={() => {
              setEditingAccount(null);
              setIsModalOpen(true);
            }}
            variant="primary"
            icon={Plus}
            aria-label={t.newAccount}
          >
            {t.newAccount}
          </PageButton>
        </PageHeader>
        <EmptyState
          title={t.noAccounts}
          description={t.accountsDescription}
          icon={Wallet}
          action={{
            label: t.newAccount || "Adicionar Conta",
            onClick: () => {
              setEditingAccount(null);
              setIsModalOpen(true);
            },
          }}
        />
        {isModalOpen && (
          <AccountModal
            account={editingAccount}
            onClose={() => {
              setIsModalOpen(false);
              setEditingAccount(null);
            }}
          />
        )}
      </div>
    );
  }

  const selectedAccountBalance = selectedAccount
    ? getAccountBalance(selectedAccount)
    : null;

  return (
    <div className="px-4 sm:px-6 lg:px-8 space-y-6 dashboard-fade-in">
      <PageHeader
        title={t.accounts}
        description={
          <span>
            {t.accountsDescription}
            {' '}
            <button
              onClick={() => setIsHelpModalOpen(true)}
              className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-500 hover:opacity-70 transition-opacity text-xs font-light"
              aria-label={t.accountsHelperTitle || "Novidades"}
            >
              ?
            </button>
          </span>
        }
      >
        <PageButton
          onClick={handleNewTransaction}
          variant="primary"
          icon={Plus}
        >
          {t.newTransaction}
        </PageButton>
      </PageHeader>

      {/* Seletor de Contas */}
      <AccountSelector
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        onAddAccount={() => {
          setEditingAccount(null);
          setIsModalOpen(true);
        }}
        baseCurrency={baseCurrency}
        selectedMonth={selectedMonth}
        householdMembers={householdMembers}
        currentUserId={currentUser?.id}
        t={t}
      />

      {/* Resumo Consolidado */}
      <div className="border-b border-gray-100 dark:border-gray-800 pb-6">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-300 mb-2">
          {t.totalAvailableBalance}
        </div>
        <div
          className={`text-3xl font-light tracking-tight ${
            totalBalance >= 0 ? "text-green-500" : "text-red-500"
          }`}
        >
          {formatCurrency(totalBalance, baseCurrency)}
        </div>
      </div>

      {selectedAccount && selectedAccountBalance ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sidebar Stats - Card Lateral */}
          <div className="space-y-6 order-1 xl:order-2">
            <AccountSidebar
              account={selectedAccount}
              accountBalance={selectedAccountBalance}
              baseCurrency={baseCurrency}
              accountOwnerInfo={accountOwnerInfo}
              isAccountOwner={isAccountOwner}
              hasCreditCards={allAccounts && Array.isArray(allAccounts) ? allAccounts.filter((a) => a && a.type === "CREDIT").length > 0 : false}
              onEdit={(account) => {
                setEditingAccount(account);
                setIsModalOpen(true);
              }}
              onDelete={handleDelete}
              onAdjustBalance={(account) => setAdjustAccountId(account.id ?? null)}
              onAllocate={() => {
                setAllocationModal({
                  isOpen: true,
                  accountId: selectedAccount.id || null,
                  creditCardId: null,
                  mode: "allocate",
                });
              }}
              onDeallocate={() => {
                setAllocationModal({
                  isOpen: true,
                  accountId: selectedAccount.id || null,
                  creditCardId: null,
                  mode: "deallocate",
                });
              }}
              t={t}
            />
          </div>

          {/* Lista de Transações */}
          <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <Calendar className="h-5 w-5" />
                      <span className="font-light capitalize text-lg">
                        {format(selectedMonth, "MMMM yyyy", {
                          locale: currentLocale,
                        })}
                      </span>
                    </div>
                  </div>
                  <MonthNavigator
                    selectedMonth={selectedMonth}
                    onMonthChange={handleMonthChange}
                    locale={locale}
                  />
                </div>
              </div>

              <div className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-light text-gray-500 dark:text-gray-400">
                    {t.transactions}
                  </h3>
                  {transactionsData?.pagination?.total && (
                    <span className="text-xs text-gray-500">
                      {transactions.length} {t.items} / {transactionsData.pagination.total}
                    </span>
                  )}
                </div>

                {transactionsLoading && transactions.length === 0 ? (
                  <div className="space-y-4 animate-pulse">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center justify-between p-3">
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <TransactionList
                    groupedTransactions={groupedTransactions}
                    accounts={accounts}
                    baseCurrency={baseCurrency}
                    customCategories={customCategories}
                    onEdit={handleEditTransaction}
                    onDelete={(id: string) => {
                      const t = transactions.find((tr) => tr.id === id);
                      if (t) {
                        handleDeleteClick({ stopPropagation: () => {} } as React.MouseEvent, t);
                      }
                    }}
                    onMarkAsPaid={handleMarkAsPaid}
                    onView={(transaction) => {
                      setViewingTransaction(transaction);
                      setEditingTransaction(null);
                      setIsTransactionModalOpen(true);
                    }}
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
              </div>
            </div>
          </div>
        </div>
      ) : selectedAccountId && transactionsLoading ? (
        // Skeleton quando tem conta selecionada mas está carregando transações
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Sidebar Stats skeleton */}
          <div className="space-y-6 order-1 xl:order-2">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg p-6 animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-6"></div>
              <div className="space-y-6">
                <div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Lista de transações skeleton */}
          <div className="xl:col-span-2 space-y-6 order-2 xl:order-1">
            <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-4">
                  <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div className="flex-1">
                          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                        </div>
                      </div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <DeleteAccountModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, account: null })}
        onConfirm={handleConfirmDelete}
        accountName={deleteModal.account?.name || ""}
      />

      {isModalOpen && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAccount(null);
          }}
        />
      )}

      {isTransactionModalOpen && selectedAccountId && (
        <TransactionModal
          transaction={editingTransaction || viewingTransaction}
          defaultAccountId={selectedAccountId}
          defaultPaid={false}
          onClose={() => {
            setIsTransactionModalOpen(false);
            setEditingTransaction(null);
            setViewingTransaction(null);
          }}
          readOnly={!!viewingTransaction}
        />
      )}

      <AdjustBalanceDialog
        open={adjustAccountId !== null}
        onClose={() => setAdjustAccountId(null)}
        accountId={adjustAccountId}
        accountName={adjustAccount?.name ?? ""}
        currentBalance={getAccountBalance(adjustAccount).totalBalance}
      />

      {allocationModal.isOpen && (
        <AllocationModal
          accountId={allocationModal.accountId}
          creditCardId={allocationModal.creditCardId}
          isOpen={allocationModal.isOpen}
          onClose={() =>
            setAllocationModal({
              isOpen: false,
              accountId: null,
              creditCardId: null,
              mode: "allocate",
            })
          }
          mode={allocationModal.mode}
        />
      )}

      <ConfirmModal
        isOpen={confirmDeleteModal.isOpen}
        onClose={() =>
          setConfirmDeleteModal({ isOpen: false, transactionId: null })
        }
        onConfirm={handleConfirmDeleteTransaction}
        title={t.delete}
        message={
          t.confirmDeleteTransaction ||
          "Tem certeza que deseja excluir esta transação?"
        }
        variant="danger"
      />

      {/* Modal de Novidades */}
      {isHelpModalOpen && createPortal(
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/60 animate-fade-in transition-opacity duration-300 ease-out"
            onClick={handleCloseHelpModal}
            aria-hidden="true"
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative w-full sm:w-96 max-w-md p-4 sm:p-5 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto animate-slide-in-bottom">
              <div className="flex items-center justify-between mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <Info className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  <h3 className="text-lg font-light tracking-tight text-gray-900 dark:text-white">
                    {t.accountsHelperTitle || "Novidades na Tela de Contas"}
                  </h3>
                </div>
                <button
                  onClick={handleCloseHelpModal}
                  className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1"
                  aria-label={t.close}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-3 text-sm font-light text-gray-600 dark:text-gray-400">
                  <p>
                    <strong className="font-medium text-gray-900 dark:text-white">
                      {t.accountsHelper1 || "Nova interface similar aos cartões de crédito!"}
                    </strong>
                  </p>
                  <p>
                    {t.accountsHelper2 || "Agora você pode visualizar suas contas bancárias de forma mais organizada:"}
                  </p>
                  <ul className="space-y-2 ml-4 list-disc">
                    <li>
                      {t.accountsHelper3 || "Seletor de contas no topo para navegação rápida"}
                    </li>
                    <li>
                      {t.accountsHelper4 || "Resumo consolidado com saldo total disponível"}
                    </li>
                    <li>
                      {t.accountsHelper5 || "Card lateral com informações detalhadas da conta selecionada"}
                    </li>
                    <li>
                      {t.accountsHelper6 || "Lista de transações paginadas do mês selecionado"}
                    </li>
                    <li>
                      {t.accountsHelper7 || "Navegação por mês para visualizar histórico"}
                    </li>
                  </ul>
                  <p className="pt-2 border-t border-gray-100 dark:border-gray-800">
                    {t.accountsHelper8 || "Tudo isso para facilitar o gerenciamento das suas finanças!"}
                  </p>
                </div>
                <button
                  onClick={handleCloseHelpModal}
                  className="w-full px-4 py-2.5 text-sm font-light tracking-tight text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 rounded-md hover:opacity-80 transition-opacity"
                >
                  {t.close}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Accounts;
