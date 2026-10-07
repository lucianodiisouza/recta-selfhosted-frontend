import { createContext, useContext, useMemo, useCallback, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { useDefaultHousehold } from '../hooks/useDefaultHousehold';
import { 
  useTransactions as useTransactionsBackend,
  useCreateTransaction,
  useUpdateTransaction,
  useDeleteTransaction,
  useBatchCreateTransactions,
  useCreateTransfer,
  type Transaction as BackendTransaction,
} from '../hooks/api/useTransactions';
// Categories are now ENUMs, no longer fetched from backend
import {
  useAccounts as useAccountsBackend,
  useCreateAccount,
  useUpdateAccount,
  useDeleteAccount,
  type Account as BackendAccount,
} from '../hooks/api/useAccounts';
import {
  useBudgets as useBudgetsBackend,
  useCreateBudget,
  useUpdateBudget,
  useDeleteBudget,
  type Budget as BackendBudget,
} from '../hooks/api/useBudgets';
import {
  useRecurringTransactions as useRecurringTransactionsBackend,
  useCreateRecurringTransaction,
  useUpdateRecurringTransaction,
  useDeleteRecurringTransaction,
  useExecuteRecurringTransaction,
  type RecurringTransaction as BackendRecurringTransaction,
} from '../hooks/api/useRecurringTransactions';
import {
  useSavingsGoals as useSavingsGoalsBackend,
  useCreateSavingsGoal,
  useUpdateSavingsGoal,
  useDeleteSavingsGoal,
  type SavingsGoal as BackendSavingsGoal,
} from '../hooks/api/useSavingsGoals';
import { 
  Transaction, 
  Category, 
  Budget,
  RecurringTransaction,
  Account,
  SavingsGoal,
  TransactionsContextType 
} from '../types';
import { addMonths, startOfMonth, isSameMonth } from 'date-fns';
import { analyticsHelpers } from '../utils/analytics';
import { CategoryName, CategoryType, RecurrenceFrequency, getCategoryDisplayName, getCategoryNameFromDisplay, parseCategoryName, getAllCategoryNames, getCategoriesByType, TransactionType, AccountType, isCustomCategoryName, toCategoryName, CUSTOM_CATEGORY_PREFIX, CustomCategoryInfo } from '../lib/enums';
import { useI18n } from './I18nContext';
import { useQueryClient } from '@tanstack/react-query';
import { useCategories } from '../hooks/api/useCategories';

// Import parseDateFromAPI and formatDateForAPI from utils
import { parseDateFromAPI, formatDateForAPI } from '../utils/format';

const TransactionsContext = createContext<TransactionsContextType>({} as TransactionsContextType);

export const useTransactions = (): TransactionsContextType => useContext(TransactionsContext);

interface TransactionsProviderProps {
  children: ReactNode;
}

// Helper functions to convert between frontend and backend types
const convertTypeToBackend = (type: TransactionType): CategoryType => {
  return type === TransactionType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
};

const convertTypeFromBackend = (type: CategoryType): TransactionType => {
  return type === CategoryType.INCOME ? TransactionType.INCOME : TransactionType.EXPENSE;
};

type CustomForConvert = { id: string; name: string; type?: string; color?: string | null; icon?: string | null }[];

const convertTransactionFromBackend = (t: BackendTransaction, translations?: Record<string, string>, custom?: CustomForConvert): Transaction | null => {
  const catName = t.categoryName || 'OTHER_EXPENSES';
  const disp = () => getCategoryDisplayName(catName, translations, custom as CustomCategoryInfo[] | undefined);

  if (t.type === 'TRANSFER' || t.type === 'ALLOCATION') {
    // For transfers and allocations, convert to frontend format but mark type appropriately
    let parsedDate: Date;
    try {
      if (typeof t.date === 'string') {
        parsedDate = parseDateFromAPI(t.date);
      } else if (t.date && typeof t.date === 'object' && 'getTime' in t.date) {
        parsedDate = t.date as Date;
      } else {
        parsedDate = new Date(t.date);
      }
      
      if (isNaN(parsedDate.getTime())) {
        return null;
      }
    } catch (error) {
      return null;
    }
    
    const categoryName = t.categoryName || (t.type === 'TRANSFER' ? CategoryName.TRANSFER : CategoryName.ALLOCATION);
    return {
      id: t.id,
      description: t.description,
      amount: Number(t.amount),
      type: t.type === 'TRANSFER' ? TransactionType.TRANSFER : TransactionType.ALLOCATION,
      category: disp(),
      categoryName: categoryName as CategoryName,
      date: parsedDate,
      paid: t.paid,
      accountId: t.accountId,
      fromAccountId: (t as any).fromAccountId,
      toAccountId: (t as any).toAccountId,
      relatedEntityId: (t as any).relatedEntityId,
      recurringTransactionId: t.recurringTransactionId,
      attachmentUrl: t.attachmentUrl,
      installmentId: t.installmentId,
      installmentNumber: t.installmentNumber,
      totalInstallments: t.totalInstallments,
      notes: (t as any).notes,
      isSplit: (t as any).isSplit || false,
      splits: (t as any).splits ? (t as any).splits.map((split: any) => ({
        userId: split.userId,
        amount: typeof split.amount === 'number' ? split.amount : (split.amount?.toNumber ? split.amount.toNumber() : Number(split.amount)),
        accountId: split.accountId || undefined,
      })) : undefined,
    };
  }

  const type = (t.type === 'INCOME' || t.type === 'EXPENSE')
    ? (t.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE)
    : (getCategoriesByType(CategoryType.INCOME).includes(catName as CategoryName) ? TransactionType.INCOME : TransactionType.EXPENSE);
  
  // Parse and validate date
  let parsedDate: Date;
  try {
    if (typeof t.date === 'string') {
      parsedDate = parseDateFromAPI(t.date);
    } else if (t.date && typeof t.date === 'object' && 'getTime' in t.date) {
      parsedDate = t.date as Date;
    } else {
      parsedDate = new Date(t.date);
    }
    
    // Validate date
    if (isNaN(parsedDate.getTime())) {
      return null; // Skip invalid transactions
    }
  } catch (error) {
    return null; // Skip invalid transactions
  }
  
  return {
    id: t.id,
    description: t.description,
    amount: Number(t.amount),
    type,
    category: disp(),
    categoryName: catName as string,
    date: parsedDate,
    paid: t.paid,
    accountId: t.accountId,
    fromAccountId: (t as any).fromAccountId,
    toAccountId: (t as any).toAccountId,
    relatedEntityId: (t as any).relatedEntityId,
    recurringTransactionId: t.recurringTransactionId,
    attachmentUrl: t.attachmentUrl,
    installmentId: t.installmentId,
    installmentNumber: t.installmentNumber,
    totalInstallments: t.totalInstallments,
    notes: (t as any).notes,
    isSplit: (t as any).isSplit || false,
    splits: (t as any).splits ? (t as any).splits.map((split: any) => ({
      userId: split.userId,
      amount: typeof split.amount === 'number' ? split.amount : (split.amount?.toNumber ? split.amount.toNumber() : Number(split.amount)),
      accountId: split.accountId || undefined,
    })) : undefined,
  };
};

// Generate categories from enum - no longer fetched from backend
const generateCategoriesFromEnum = (translations?: Record<string, string>): Category[] => {
  return getAllCategoryNames().map((categoryName) => ({
    id: categoryName, // Use enum value as ID
    name: getCategoryDisplayName(categoryName, translations),
    description: undefined,
  }));
};

const convertAccountFromBackend = (a: BackendAccount): Account => {
  // Backend já retorna em maiúsculas, usar diretamente
  return {
    id: a.id,
    name: a.name,
    type: a.type, // Já está no formato correto (maiúsculas)
    balance: Number(a.balance), // Legacy field
    // Usar !== null && !== undefined para permitir valor 0
    totalBalance: (a.totalBalance !== null && a.totalBalance !== undefined) 
      ? Number(a.totalBalance) 
      : Number(a.balance),
    availableBalance: (a.availableBalance !== null && a.availableBalance !== undefined)
      ? (() => {
          // Se availableBalance é 0 mas balance não é 0, provavelmente é uma conta antiga
          // Nesse caso, usar balance como fallback
          const available = Number(a.availableBalance);
          const balance = Number(a.balance);
          if (available === 0 && balance !== 0) {
            return balance;
          }
          return available;
        })()
      : (a.totalBalance !== null && a.totalBalance !== undefined)
        ? Number(a.totalBalance)
        : Number(a.balance),
    allocatedBalance: (a.allocatedBalance !== null && a.allocatedBalance !== undefined)
      ? Number(a.allocatedBalance)
      : 0,
    color: a.color,
    icon: a.icon,
    creditLimit: (a.creditLimit !== null && a.creditLimit !== undefined) ? Number(a.creditLimit) : undefined,
    totalLimit: (a.totalLimit !== null && a.totalLimit !== undefined)
      ? Number(a.totalLimit)
      : (a.creditLimit !== null && a.creditLimit !== undefined)
        ? Number(a.creditLimit)
        : undefined,
    availableLimit: (a.availableLimit !== null && a.availableLimit !== undefined) ? Number(a.availableLimit) : undefined,
    dueDay: a.dueDay,
    closingDay: a.closingDay,
    bestDayOffset: a.bestDayOffset,
    linkedAccountId: a.linkedAccountId,
    isPersonal: (a as any).isPersonal,
    accountOwnerId: (a as any).accountOwnerId || null,
  };
};

const convertBudgetFromBackend = (b: BackendBudget, translations?: Record<string, string>, custom?: CustomForConvert): Budget => {
  let parsedMonth: Date;
  try {
    if (typeof b.month === 'string') {
      parsedMonth = parseDateFromAPI(b.month);
    } else if (b.month && typeof b.month === 'object' && 'getTime' in b.month) {
      parsedMonth = b.month as Date;
    } else {
      parsedMonth = new Date(b.month);
    }
    if (isNaN(parsedMonth.getTime())) {
      parsedMonth = startOfMonth(new Date());
    }
  } catch {
    parsedMonth = startOfMonth(new Date());
  }
  // Preserve the GENERAL pseudo-category as-is so the UI keeps recognising it.
  // Fall back to OTHER_EXPENSES only when the backend omits categoryName entirely.
  const categoryName = (b.categoryName || 'OTHER_EXPENSES') as string;
  const displayCategory =
    categoryName === 'GENERAL'
      ? translations?.general || 'Geral'
      : getCategoryDisplayName(categoryName, translations, custom as CustomCategoryInfo[] | undefined);
  return {
    id: b.id,
    category: displayCategory,
    categoryName,
    amount: Number(b.monthlyLimit),
    month: parsedMonth,
    type: convertTypeFromBackend(b.type),
  };
};

const convertRecurringTransactionFromBackend = (r: BackendRecurringTransaction, translations?: Record<string, string>, custom?: CustomForConvert): RecurringTransaction => {
  const rCat = r.categoryName ?? 'SALARY';
  let type: TransactionType;
  if (isCustomCategoryName(rCat) && custom?.length) {
    const id = rCat.slice(CUSTOM_CATEGORY_PREFIX.length);
    const c = custom.find((x) => x.id === id);
    type = c?.type === 'INCOME' ? TransactionType.INCOME : TransactionType.EXPENSE;
  } else {
    type = getCategoriesByType(CategoryType.INCOME).includes(rCat as CategoryName) ? TransactionType.INCOME : TransactionType.EXPENSE;
  }

  const rawFrequency = (r as any)?.frequency;
  const normalizedFrequency = typeof rawFrequency === 'string' ? rawFrequency.toLowerCase() : 'monthly';
  const startDate = r.startDate ? parseDateFromAPI(r.startDate) : new Date();
  const nextDueDate = r.nextRunAt ? parseDateFromAPI(r.nextRunAt) : startDate;

  return {
    id: r.id,
    description: r.description ?? '',
    amount: Number(r.amount),
    type,
    category: getCategoryDisplayName(rCat, translations, custom as CustomCategoryInfo[] | undefined),
    categoryName: rCat as string,
    frequency: (normalizedFrequency as 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly'),
    startDate,
    endDate: r.endDate ? parseDateFromAPI(r.endDate) : undefined,
    nextDueDate,
    accountId: r.accountId ?? '',
    isActive: r.isActive ?? true,
    // Left undefined when the server does not send it, so the app can tell "off" from "not supported".
    followLastAmount: r.followLastAmount,
    lastOccurrenceDate: r.lastOccurrenceDate === undefined ? undefined : (r.lastOccurrenceDate ?? null),
  };
};

const convertSavingsGoalFromBackend = (g: BackendSavingsGoal): SavingsGoal => {
  return {
    id: g.id,
    name: g.name,
    targetAmount: Number(g.targetAmount),
    currentAmount: Number(g.currentAmount),
    targetDate: g.targetDate ? new Date(g.targetDate) : undefined,
    accountId: g.accountId,
  };
};

export const TransactionsProvider = ({ children }: TransactionsProviderProps) => {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  const { householdId, isLoading: householdLoading } = useDefaultHousehold();
  const { t } = useI18n();
  const queryClient = useQueryClient();


  // Fetch all data - only when householdId is available AND user is authenticated
  // Memoize params to prevent unnecessary re-renders
  // NOTE: Using limit 25 to match Transactions page pagination
  // Other pages that need transactions should use their own paginated queries
  const transactionsParams = useMemo(() => 
    (householdId && isAuthenticated) ? { householdId, limit: 25 } : { householdId: '' },
    [householdId, isAuthenticated]
  );
  const accountsParams = useMemo(() => 
    (householdId && isAuthenticated) ? { householdId } : { householdId: '' },
    [householdId, isAuthenticated]
  );
  const budgetsParams = useMemo(() => 
    (householdId && isAuthenticated) ? { householdId } : {},
    [householdId, isAuthenticated]
  );
  const recurringParams = useMemo(() => 
    (householdId && isAuthenticated) ? { householdId } : { householdId: '' },
    [householdId, isAuthenticated]
  );
  const savingsGoalsParams = useMemo(() => 
    (householdId && isAuthenticated) ? { householdId } : { householdId: '' },
    [householdId, isAuthenticated]
  );

  // Only fetch when authenticated AND householdId is available
  // These queries have enabled checks in their hooks, but we also check here to avoid unnecessary query registration
  const { data: transactionsData, isLoading: transactionsLoading } = useTransactionsBackend(transactionsParams);
  const { data: accountsData, isLoading: accountsLoading } = useAccountsBackend(accountsParams);
  const { data: budgetsData, isLoading: budgetsLoading } = useBudgetsBackend(budgetsParams);
  const { data: recurringData, isLoading: recurringLoading } = useRecurringTransactionsBackend(recurringParams);
  const { data: savingsGoalsData, isLoading: savingsGoalsLoading } = useSavingsGoalsBackend(savingsGoalsParams);
  const { data: categoriesData = [] } = useCategories({ householdId: householdId ?? undefined, type: undefined });
  const custom = useMemo(() =>
    categoriesData.filter((c: { isSystem: boolean }) => !c.isSystem).map((c: { id: string; name: string; type: string; color?: string | null; icon?: string | null }) =>
      ({ id: c.id, name: c.name, type: c.type, color: c.color, icon: c.icon })
    ), [categoriesData]);

  // Limpar todos os dados quando usuário faz logout
  useEffect(() => {
    if (!isAuthenticated) {
      // Limpar todo o cache do React Query quando usuário não está autenticado
      // Isso garante que dados de usuários anteriores não sejam exibidos
      queryClient.clear();
      queryClient.removeQueries();
      queryClient.cancelQueries();
    }
  }, [isAuthenticated, queryClient]);

  // Refetch accounts quando householdId mudar (importante quando é criado pela primeira vez)
  // Só executar se usuário estiver autenticado
  useEffect(() => {
    if (householdId && isAuthenticated) {
      // Aguardar um pouco para garantir que a query esteja habilitada
      const timeoutId = setTimeout(() => {
        queryClient.refetchQueries({ 
          queryKey: ['accounts', { householdId }],
          exact: false 
        });
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [householdId, isAuthenticated, queryClient]);


  // Mutations
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransaction();
  const deleteTransaction = useDeleteTransaction();
  const batchCreateTransactions = useBatchCreateTransactions();
  const createTransferMutation = useCreateTransfer();
  
  // Categories are now ENUMs, no CRUD operations needed
  
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();
  
  const createRecurringTransaction = useCreateRecurringTransaction();
  const updateRecurringTransaction = useUpdateRecurringTransaction();
  const deleteRecurringTransaction = useDeleteRecurringTransaction();
  const executeRecurringTransaction = useExecuteRecurringTransaction();
  
  const createSavingsGoal = useCreateSavingsGoal();
  const updateSavingsGoal = useUpdateSavingsGoal();
  const deleteSavingsGoal = useDeleteSavingsGoal();

  // Generate categories from enum - always available
  const categories = useMemo(() => generateCategoriesFromEnum(t as unknown as Record<string, string>), [t]);

  const accounts = useMemo(() => {
    // Retornar array vazio se não estiver autenticado
    if (!isAuthenticated) return [];
    if (!accountsData) return [];
    // Backend retorna {accounts: [...], totals: [...]}, não um array direto
    const accountsArray = Array.isArray(accountsData) 
      ? accountsData 
      : (accountsData as { accounts?: BackendAccount[] })?.accounts || [];
    if (!Array.isArray(accountsArray)) return [];
    return accountsArray.map(convertAccountFromBackend);
  }, [accountsData, isAuthenticated]);

  const transactions = useMemo(() => {
    // Retornar array vazio se não estiver autenticado
    if (!isAuthenticated) return [];
    const transactionsList = Array.isArray(transactionsData) 
      ? transactionsData 
      : transactionsData?.data || [];
    if (!transactionsList.length) return [];
    return transactionsList
      .map(tr => convertTransactionFromBackend(tr, t as unknown as Record<string, string>, custom))
      .filter((x): x is Transaction => x !== null)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [transactionsData, t, custom, isAuthenticated]);

  const budgets = useMemo(() => {
    // Retornar array vazio se não estiver autenticado
    if (!isAuthenticated) return [];
    if (!budgetsData) return [];
    if (!Array.isArray(budgetsData)) return [];
    return budgetsData.map(b => convertBudgetFromBackend(b, t as unknown as Record<string, string>, custom));
  }, [budgetsData, t, custom, isAuthenticated]);

  const recurringTransactions = useMemo(() => {
    // Retornar array vazio se não estiver autenticado
    if (!isAuthenticated) return [];
    if (!recurringData) return [];
    // Backend retorna {success: true, data: [...]}, não um array direto
    const recurringArray = Array.isArray(recurringData) 
      ? recurringData 
      : (recurringData as { data?: BackendRecurringTransaction[] })?.data || [];
    if (!Array.isArray(recurringArray)) return [];
    return recurringArray.map(r => convertRecurringTransactionFromBackend(r, t as unknown as Record<string, string>, custom));
  }, [recurringData, t, custom, isAuthenticated]);

  const savingsGoals = useMemo(() => {
    // Retornar array vazio se não estiver autenticado
    if (!isAuthenticated) return [];
    if (!savingsGoalsData) return [];
    if (!Array.isArray(savingsGoalsData)) return [];
    return savingsGoalsData.map(convertSavingsGoalFromBackend);
  }, [savingsGoalsData, isAuthenticated]);

  // Se não estiver autenticado, sempre mostrar loading para evitar mostrar dados antigos
  const loading = !isAuthenticated || householdLoading || transactionsLoading || 
                  accountsLoading || budgetsLoading || recurringLoading || savingsGoalsLoading;

  // Transaction functions
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id' | 'userId'>): Promise<void> => {
    if (!currentUser) return;

    const categoryName = toCategoryName(transaction.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined) ?? transaction.category;
    if (!categoryName) {
      throw new Error(`Categoria "${transaction.category}" não encontrada`);
    }

    // Resolve accountId: use transaction.accountId if provided, otherwise first account, or undefined if none
    const resolvedAccountId = transaction.accountId || accounts[0]?.id || undefined;
    
    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    await createTransaction.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      description: transaction.description,
      amount: transaction.amount,
      categoryName: categoryName as CategoryName,
      ...(resolvedAccountId && { accountId: resolvedAccountId }), // Only include if valid UUID exists
      date: formatDateForAPI(transaction.date),
      paid: transaction.paid !== undefined ? transaction.paid : true,
      ...(transaction.isSplit && { isSplit: transaction.isSplit }),
      ...(transaction.splits && transaction.splits.length > 0 && { splits: transaction.splits }),
      ...(transaction.recurringTransactionId && { recurringTransactionId: transaction.recurringTransactionId }),
      ...(transaction.attachmentUrl && { attachmentUrl: transaction.attachmentUrl }),
      ...(transaction.installmentId && { installmentId: transaction.installmentId }),
      ...(transaction.installmentNumber && { installmentNumber: transaction.installmentNumber }),
      ...(transaction.totalInstallments && { totalInstallments: transaction.totalInstallments }),
    });

    analyticsHelpers.logTransactionCreated(
      transaction.type,
      !!transaction.accountId,
      transaction.paid !== false
    );
  }, [householdId, currentUser, accounts, createTransaction, t, custom]);

  const updateTransactionFn = useCallback(async (id: string, transaction: Partial<Transaction>): Promise<{ recurringUpdated?: { id: string; amount: number } }> => {
    const updateData: Record<string, unknown> = {};
    
    if (transaction.description !== undefined) updateData.description = transaction.description;
    if (transaction.amount !== undefined) updateData.amount = transaction.amount;
    if (transaction.paid !== undefined) updateData.paid = transaction.paid;
    if (transaction.date) updateData.date = formatDateForAPI(transaction.date);
    if (transaction.accountId) updateData.accountId = transaction.accountId;
    
    // Include type if provided (allows changing between INCOME and EXPENSE)
    if (transaction.type !== undefined) {
      updateData.type = transaction.type;
    }
    
    if (transaction.category != null) {
      const categoryName = toCategoryName(transaction.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined);
      if (categoryName) updateData.categoryName = categoryName as string;
    }

    if (transaction.installmentId !== undefined) updateData.installmentId = transaction.installmentId || null;
    if (transaction.installmentNumber !== undefined) updateData.installmentNumber = transaction.installmentNumber || null;
    if (transaction.totalInstallments !== undefined) updateData.totalInstallments = transaction.totalInstallments || null;
    if (transaction.attachmentUrl !== undefined) updateData.attachmentUrl = transaction.attachmentUrl || null;

    const updated = await updateTransaction.mutateAsync({ id, ...updateData });

    if (transaction.type) {
      analyticsHelpers.logTransactionUpdated(transaction.type);
    }
    return updated?.recurringUpdated ? { recurringUpdated: updated.recurringUpdated } : {};
  }, [updateTransaction, t, custom]);

  const deleteTransactionFn = useCallback(async (id: string): Promise<void> => {
    await deleteTransaction.mutateAsync(id);
    analyticsHelpers.logTransactionDeleted();
  }, [deleteTransaction]);

  // Category functions - Categories are now ENUMs, no CRUD operations needed
  // These functions are kept for backward compatibility but are no-ops
  const addCategory = useCallback(async (): Promise<void> => {
    // Categories are now ENUMs, no need to create them
    return Promise.resolve();
  }, []);

  const updateCategoryFn = useCallback(async (): Promise<void> => {
    // Categories are now ENUMs, no need to update them
    return Promise.resolve();
  }, []);

  const deleteCategoryFn = useCallback(async (): Promise<void> => {
    // Categories are now ENUMs, no need to delete them
    return Promise.resolve();
  }, []);

  // Budget functions
  const addBudget = useCallback(async (budget: Omit<Budget, 'id' | 'userId'>): Promise<void> => {
    if (!currentUser) return;

    let categoryName = toCategoryName(budget.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined) ?? parseCategoryName(budget.category ?? '');
    if (!categoryName) {
      // "General" / "Geral" is a special pseudo-category for budgets that represents
      // the total spending/income for the month. Send it as-is to the backend so it is
      // not silently transformed into OTHER_EXPENSES.
      const trimmed = (budget.category ?? '').trim();
      if (trimmed === 'Geral' || trimmed === 'General' || trimmed === 'GENERAL') {
        categoryName = 'GENERAL';
      } else {
        const foundCategory = categories.find(c => c.name.toLowerCase().trim() === trimmed.toLowerCase());
        if (foundCategory) {
          categoryName = toCategoryName(foundCategory.name, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined) ?? getCategoryNameFromDisplay(foundCategory.name, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined);
        }
        if (!categoryName) {
          throw new Error(`Categoria "${budget.category}" não encontrada. Categorias disponíveis: ${categories.map(c => c.name).join(', ') || 'nenhuma'}`);
        }
      }
    }

    const monthStart = startOfMonth(budget.month);

    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    await createBudget.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      categoryName: categoryName as CategoryName,
      monthlyLimit: budget.amount,
      month: formatDateForAPI(monthStart),
      type: convertTypeToBackend(budget.type),
    });

    analyticsHelpers.logBudgetCreated(budget.type, budget.category);
  }, [householdId, currentUser, createBudget, categories, t, custom]);

  const updateBudgetFn = useCallback(async (id: string, budget: Partial<Budget>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    
    if (budget.amount !== undefined) updateData.monthlyLimit = budget.amount;
    if (budget.category != null) {
      const categoryName = toCategoryName(budget.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined);
      if (categoryName) updateData.categoryName = categoryName as string;
    }
    if (budget.month) {
      const monthStart = startOfMonth(budget.month);
      updateData.month = formatDateForAPI(monthStart);
    }
    if (budget.type) {
      updateData.type = convertTypeToBackend(budget.type);
    }

    await updateBudget.mutateAsync({ id, ...updateData });

    if (budget.type) {
      analyticsHelpers.logBudgetUpdated(budget.type);
    }
  }, [updateBudget, t, custom]);

  const deleteBudgetFn = useCallback(async (id: string): Promise<void> => {
    await deleteBudget.mutateAsync(id);
    analyticsHelpers.logBudgetDeleted();
  }, [deleteBudget]);

  // Recurring Transaction functions
  const addRecurringTransaction = useCallback(async (recurring: Omit<RecurringTransaction, 'id' | 'userId'>): Promise<string> => {
    if (!currentUser) {
      throw new Error('Usuário não autenticado');
    }

    const categoryName = toCategoryName(recurring.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined);
    if (!categoryName) {
      throw new Error(`Categoria "${recurring.category}" não encontrada`);
    }

    const frequencyEnum = recurring.frequency.toUpperCase() as RecurrenceFrequency;
    
    const resolvedAccountId = recurring.accountId || accounts[0]?.id;
    if (!resolvedAccountId) {
      throw new Error('Crie ou selecione uma conta antes de adicionar uma recorrência');
    }
    if (!recurring.nextDueDate || Number.isNaN(recurring.nextDueDate.getTime())) {
      throw new Error('Data de próxima execução inválida');
    }

    const result = await createRecurringTransaction.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      description: recurring.description,
      amount: recurring.amount,
      categoryName: categoryName as CategoryName,
      accountId: resolvedAccountId,
      frequency: frequencyEnum,
      startDate: formatDateForAPI(recurring.startDate),
      nextRunAt: formatDateForAPI(recurring.nextDueDate),
      endDate: recurring.endDate ? formatDateForAPI(recurring.endDate) : undefined,
      isActive: recurring.isActive,
      ...(recurring.followLastAmount !== undefined && { followLastAmount: recurring.followLastAmount }),
    });

    analyticsHelpers.logRecurringTransactionCreated(recurring.type, recurring.frequency);
    
    return result.id;
  }, [householdId, currentUser, accounts, createRecurringTransaction, t, custom]);

  const updateRecurringTransactionFn = useCallback(async (id: string, recurring: Partial<RecurringTransaction>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    
    if (recurring.description !== undefined) updateData.description = recurring.description;
    if (recurring.amount !== undefined) updateData.amount = recurring.amount;
    if (recurring.type !== undefined) updateData.type = convertTypeToBackend(recurring.type);
    if (recurring.frequency !== undefined) {
      // Convert frequency from lowercase to enum
      updateData.frequency = recurring.frequency.toUpperCase() as RecurrenceFrequency;
    }
    if (recurring.isActive !== undefined) updateData.isActive = recurring.isActive;
    if (recurring.followLastAmount !== undefined) updateData.followLastAmount = recurring.followLastAmount;
    if (recurring.startDate) updateData.startDate = formatDateForAPI(recurring.startDate);
    if (recurring.endDate !== undefined) {
      updateData.endDate = recurring.endDate ? formatDateForAPI(recurring.endDate) : null;
    }
    if (recurring.nextDueDate) updateData.nextRunAt = formatDateForAPI(recurring.nextDueDate);
    if (recurring.accountId !== undefined) updateData.accountId = recurring.accountId || null;
    
    if (recurring.category != null) {
      const categoryName = toCategoryName(recurring.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined);
      if (categoryName) updateData.categoryName = categoryName as string;
    }

    await updateRecurringTransaction.mutateAsync({ id, ...updateData });

    if (recurring.isActive !== undefined) {
      analyticsHelpers.logRecurringTransactionToggled(recurring.isActive);
    } else {
      analyticsHelpers.logRecurringTransactionUpdated();
    }
  }, [updateRecurringTransaction, t, custom]);

  const deleteRecurringTransactionFn = useCallback(async (id: string): Promise<void> => {
    await deleteRecurringTransaction.mutateAsync(id);
    analyticsHelpers.logRecurringTransactionDeleted();
  }, [deleteRecurringTransaction]);

  // Account functions
  const addAccount = useCallback(async (account: Omit<Account, 'id' | 'userId'>): Promise<void> => {
    if (!currentUser) return;

    // Tipo já está no formato correto (maiúsculas)
    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    const createdAccount = await createAccount.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      name: account.name,
      type: account.type,
      balance: account.balance,
      color: account.color,
      icon: account.icon,
      creditLimit: account.creditLimit,
      dueDay: account.dueDay,
      bestDayOffset: account.bestDayOffset,
    });

    // A conta criada retorna com o householdId (que pode ter sido criado pelo backend)
    const accountHouseholdId = createdAccount.householdId;

    // Se o householdId não estava disponível antes, o backend criou um household pessoal
    // Precisamos refetch do auth/me para obter o novo householdId E aguardar que seja atualizado
    if (!householdId && accountHouseholdId) {
      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
      // Aguardar um pouco para o hook useDefaultHousehold atualizar
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    // Garantir que a query seja refetchada para sincronizar com o servidor
    // A atualização otimista já adicionou ao cache, mas precisamos garantir refetch
    if (accountHouseholdId) {
      // Invalidar primeiro para forçar refetch
      queryClient.invalidateQueries({ 
        queryKey: ['accounts', { householdId: accountHouseholdId }],
        exact: false 
      });
      
      // Aguardar um pouco e então refetch
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Refetch explícito da query específica
      await queryClient.refetchQueries({ 
        queryKey: ['accounts', { householdId: accountHouseholdId }],
        exact: false 
      });
    } else {
      // Se não temos householdId, invalidar todas e aguardar
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    }

    analyticsHelpers.logAccountCreated(account.type);
  }, [householdId, currentUser, createAccount, queryClient]);

  const updateAccountFn = useCallback(async (id: string, account: Partial<Account>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    
    Object.keys(account).forEach((key) => {
      const value = account[key as keyof Account];
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    await updateAccount.mutateAsync({ id, ...updateData });

    if (account.type) {
      analyticsHelpers.logAccountUpdated(account.type);
    }
  }, [updateAccount]);

  const deleteAccountFn = useCallback(async (id: string, deleteTransactions = false): Promise<void> => {
    const accountToDelete = accounts.find(a => a.id === id);
    await deleteAccount.mutateAsync({ accountId: id, deleteTransactions });

    if (accountToDelete) {
      analyticsHelpers.logAccountDeleted(accountToDelete.type);
    }
  }, [accounts, deleteAccount]);

  // Savings Goal functions
  const addSavingsGoal = useCallback(async (goal: Omit<SavingsGoal, 'id' | 'userId'>): Promise<void> => {
    if (!currentUser) return;

    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    await createSavingsGoal.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      name: goal.name,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount ?? 0,
      targetDate: goal.targetDate ? formatDateForAPI(goal.targetDate) : undefined,
      accountId: goal.accountId,
    });

    analyticsHelpers.logSavingsGoalCreated();
  }, [householdId, currentUser, createSavingsGoal]);

  const updateSavingsGoalFn = useCallback(async (id: string, goal: Partial<SavingsGoal>): Promise<void> => {
    const updateData: Record<string, unknown> = {};
    
    if (goal.name !== undefined) updateData.name = goal.name;
    if (goal.targetAmount !== undefined) updateData.targetAmount = goal.targetAmount;
    if (goal.currentAmount !== undefined) updateData.currentAmount = goal.currentAmount;
    if (goal.targetDate !== undefined) {
      updateData.targetDate = goal.targetDate ? formatDateForAPI(goal.targetDate) : null;
    }
    if (goal.accountId !== undefined) {
      updateData.accountId = goal.accountId || null;
    }

    await updateSavingsGoal.mutateAsync({ id, ...updateData });
    analyticsHelpers.logSavingsGoalUpdated();
  }, [updateSavingsGoal]);

  const deleteSavingsGoalFn = useCallback(async (id: string): Promise<void> => {
    await deleteSavingsGoal.mutateAsync(id);
    analyticsHelpers.logSavingsGoalDeleted();
  }, [deleteSavingsGoal]);

  // Transfer functions
  const createTransfer = useCallback(async (data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    description?: string;
    date: Date;
    notes?: string;
  }): Promise<void> => {
    if (!currentUser) return;

    // Get account types for analytics
    const fromAccount = accounts.find(acc => acc.id === data.fromAccountId);
    const toAccount = accounts.find(acc => acc.id === data.toAccountId);
    const fromAccountType = fromAccount?.type || 'UNKNOWN';
    const toAccountType = toAccount?.type || 'UNKNOWN';

    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    await createTransferMutation.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      fromAccountId: data.fromAccountId,
      toAccountId: data.toAccountId,
      amount: data.amount,
      description: data.description,
      date: formatDateForAPI(data.date),
      notes: data.notes,
    });

    analyticsHelpers.logAccountTransferCreated(fromAccountType, toAccountType, data.amount);
  }, [householdId, currentUser, createTransferMutation, accounts]);

  // Installment functions
  const createInstallments = useCallback(async (transaction: Omit<Transaction, 'id' | 'userId'>, installments: number): Promise<void> => {
    if (!currentUser) return;
    if (installments < 2) {
      await addTransaction(transaction);
      return;
    }

    const installmentAmount = transaction.amount / installments;
    const installmentId = Date.now().toString();

    // Detect if the purchase is on a credit card — installments on a credit
    // card always settle the limit immediately (paid = true) regardless of
    // the purchase date, otherwise the "Atrasado" tag triggers for every
    // historical installment.
    const linkedAccount = accounts.find(a => a.id === transaction.accountId);
    const isCreditCardInstallment =
      !!linkedAccount && linkedAccount.type === AccountType.CREDIT;

    // For credit cards, the purchase date and the first-invoice month can
    // differ. If the user buys on or after closingDay, the purchase lands in
    // the NEXT month's invoice — so the first installment must be pushed one
    // month forward to avoid two installments falling in the same calendar
    // month (the bug reported on Reddit).
    const purchaseDate = new Date(transaction.date);
    let firstInstallmentAnchor = purchaseDate;
    if (
      isCreditCardInstallment &&
      linkedAccount.closingDay !== undefined &&
      linkedAccount.closingDay !== null &&
      purchaseDate.getDate() >= linkedAccount.closingDay
    ) {
      firstInstallmentAnchor = addMonths(purchaseDate, 1);
    }

    const transactionsToCreate = [];
    for (let i = 0; i < installments; i++) {
      const installmentDate = addMonths(firstInstallmentAnchor, i);
      const catName = (toCategoryName(transaction.category, t as unknown as Record<string, string>, custom as CustomCategoryInfo[] | undefined) || CategoryName.OTHER_EXPENSES) as CategoryName;
      const accountId = transaction.accountId || accounts[0]?.id;
      if (!accountId) {
        throw new Error('Conta é obrigatória para criar parcelas');
      }
      transactionsToCreate.push({
        description: transaction.description,
        amount: installmentAmount,
        categoryName: catName,
        accountId,
        date: formatDateForAPI(installmentDate),
        paid: isCreditCardInstallment
          ? true
          : (transaction.paid !== undefined ? transaction.paid : false),
        installmentId,
        installmentNumber: i + 1,
        totalInstallments: installments,
      });
    }

    // householdId é opcional - backend criará household pessoal automaticamente se não fornecido
    await batchCreateTransactions.mutateAsync({
      ...(householdId && { householdId }), // Only include if exists
      transactions: transactionsToCreate,
    });
  }, [householdId, currentUser, accounts, addTransaction, batchCreateTransactions, t, custom]);

  // Process recurring transactions
  const processRecurringTransactions = useCallback(async (): Promise<void> => {
    if (!householdId || !currentUser || recurringTransactions.length === 0) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentMonth = startOfMonth(today);

    // Verificar quais recorrências já foram processadas neste mês
    const processedRecurringIds = new Set<string>();
    transactions.forEach(t => {
      if (t.recurringTransactionId && isSameMonth(t.date, currentMonth)) {
        processedRecurringIds.add(t.recurringTransactionId);
      }
    });

    let processedCount = 0;

    // Processar apenas as recorrências ativas que ainda não foram processadas neste mês
    for (const recurring of recurringTransactions) {
      if (!recurring.isActive) continue;
      if (recurring.endDate && new Date(recurring.endDate) < today) continue;
      
      // Se já foi processada neste mês, pular
      if (recurring.id && processedRecurringIds.has(recurring.id)) {
        continue;
      }

      // Executar recorrência
      await executeRecurringTransaction.mutateAsync({
        recurringId: recurring.id!,
      });

      processedCount++;
    }

    // Se não processou nada novo, informar ao usuário
    if (processedCount === 0) {
      throw new Error('Todas as recorrências ativas já foram processadas neste mês');
    }
  }, [householdId, currentUser, recurringTransactions, transactions, executeRecurringTransaction]);

  // Export to CSV
  const exportToCSV = useCallback((): void => {
    const headers = [t.date, t.description, t.type, t.category, t.amount, t.account];
    const rows = transactions.map(transaction => [
      transaction.date.toLocaleDateString(),
      transaction.description,
      transaction.type === TransactionType.INCOME ? t.income : t.expense,
      transaction.category || t.noCategory,
      transaction.amount.toFixed(2),
      transaction.accountId ? accounts.find(a => a.id === transaction.accountId)?.name || '' : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transacoes_${formatDateForAPI(new Date())}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    analyticsHelpers.logTransactionExported();
  }, [transactions, accounts, t]);

  const value: TransactionsContextType = useMemo(() => ({
    transactions,
    categories,
    customCategories: custom,
    budgets,
    recurringTransactions,
    accounts,
    savingsGoals,
    loading,
    addTransaction,
    updateTransaction: updateTransactionFn,
    deleteTransaction: deleteTransactionFn,
    addCategory,
    updateCategory: updateCategoryFn,
    deleteCategory: deleteCategoryFn,
    addBudget,
    updateBudget: updateBudgetFn,
    deleteBudget: deleteBudgetFn,
    addRecurringTransaction,
    updateRecurringTransaction: updateRecurringTransactionFn,
    deleteRecurringTransaction: deleteRecurringTransactionFn,
    addAccount,
    updateAccount: updateAccountFn,
    deleteAccount: deleteAccountFn,
    addSavingsGoal,
    updateSavingsGoal: updateSavingsGoalFn,
    deleteSavingsGoal: deleteSavingsGoalFn,
    createInstallments,
    createTransfer,
    exportToCSV,
    processRecurringTransactions,
  }), [
    transactions,
    categories,
    custom,
    budgets,
    recurringTransactions,
    accounts,
    savingsGoals,
    loading,
    addTransaction,
    updateTransactionFn,
    deleteTransactionFn,
    addCategory,
    updateCategoryFn,
    deleteCategoryFn,
    addBudget,
    updateBudgetFn,
    deleteBudgetFn,
    addRecurringTransaction,
    updateRecurringTransactionFn,
    deleteRecurringTransactionFn,
    addAccount,
    updateAccountFn,
    deleteAccountFn,
    addSavingsGoal,
    updateSavingsGoalFn,
    deleteSavingsGoalFn,
    createInstallments,
    createTransfer,
    exportToCSV,
    processRecurringTransactions,
  ]);

  return (
    <TransactionsContext.Provider value={value}>
      {children}
    </TransactionsContext.Provider>
  );
};
