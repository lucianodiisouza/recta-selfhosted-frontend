import { useQuery, useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState, useEffect, useMemo } from 'react';
import { apiClient } from '../../utils/api';
import { CategoryType, CategoryName } from '../../lib/enums';
import { formatDateForAPI } from '../../utils/format';
import { useAuth } from '../../context/AuthContext';

export interface TransactionSplit {
  id: string;
  transactionId: string;
  userId: string;
  amount: number;
  paid: boolean;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName?: string | null;
  };
}

export interface Transaction {
  id: string;
  householdId: string;
  type?: 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'ALLOCATION'; // Transaction type from backend
  description: string;
  amount: number;
  categoryName?: CategoryName; // Optional for TRANSFER/ALLOCATION
  accountId?: string; // Optional for TRANSFER
  fromAccountId?: string; // For TRANSFER
  toAccountId?: string; // For TRANSFER
  relatedEntityId?: string; // For ALLOCATION (credit card ID)
  date: string;
  paid: boolean;
  isSplit?: boolean; // Indicates if transaction is split between members
  splits?: TransactionSplit[]; // Array of splits when isSplit is true
  recurringTransactionId?: string;
  installmentId?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  attachmentUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionSummary {
  income: number; // Backend retorna 'income', não 'totalIncome'
  expenses: number; // Backend retorna 'expenses', não 'totalExpense'
  balance: number;
  transactionCount: number; // Backend retorna 'transactionCount'
  // Campos calculados no frontend para compatibilidade
  totalIncome?: number;
  totalExpense?: number;
  period?: {
    start: string;
    end: string;
  };
}

export interface SpendingByCategory {
  categoryName: CategoryName;
  categoryColor?: string;
  total: number;
  count: number;
}

export interface ListTransactionsParams {
  householdId?: string;
  cursor?: string;
  limit?: number;
  startDate?: Date | string;
  endDate?: Date | string;
  month?: string; // YYYY-MM format
  type?: CategoryType;
  categoryName?: CategoryName;
  accountId?: string;
  search?: string;
}

export interface TransactionSummaryParams {
  householdId?: string;
  startDate?: Date | string;
  endDate?: Date | string;
  month?: string; // YYYY-MM format
  type?: CategoryType;
}

export interface PaginatedTransactionsResponse {
  data: Transaction[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total?: number;
  };
}

/**
 * List transactions with cursor-based pagination
 */
export function useTransactions(params: ListTransactionsParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['transactions', 'list', params],
    enabled: isAuthenticated && !!params.householdId, // Only fetch when authenticated and householdId is available
    refetchOnMount: true, // Refetch quando a página é montada (pode ter novas transações do cronjob)
    refetchOnWindowFocus: false, // Não refetch ao focar na janela (evitar refetches desnecessários)
    staleTime: 0, // Sempre considerar stale para garantir refetch após mutações ou cronjob
    queryFn: async () => {
      // Convert dates to YYYY-MM-DD format using local time (not UTC) to avoid timezone issues
      const queryParams: Record<string, unknown> = {
        ...params,
        startDate: params.startDate ? formatDateForAPI(params.startDate) : params.startDate,
        endDate: params.endDate ? formatDateForAPI(params.endDate) : params.endDate,
      };
      
      // Remove undefined values
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined) {
          delete queryParams[key];
        }
      });

      const response = await apiClient.get<any>('/transactions', queryParams);
      // Backend returns { success: true, data: [...], pagination: {...} }
      // But ApiResponse type doesn't include pagination, so we need to access it directly
      const pagination = (response as any).pagination;
      
      // We need to return { data: [...], pagination: {...} }
      if (response.success && response.data) {
        return {
          data: response.data,
          pagination: pagination || {
            nextCursor: null,
            hasMore: false,
          },
        } as PaginatedTransactionsResponse;
      }
      // Fallback: if response is already in the correct format
      return response as PaginatedTransactionsResponse;
    },
  });
}

/**
 * Load more transactions (for infinite scroll or load more button)
 */
export function useLoadMoreTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: ListTransactionsParams & { cursor: string }) => {
      // Convert dates to YYYY-MM-DD format using local time (not UTC) to avoid timezone issues
      const queryParams: Record<string, unknown> = {
        ...params,
        startDate: params.startDate ? formatDateForAPI(params.startDate) : params.startDate,
        endDate: params.endDate ? formatDateForAPI(params.endDate) : params.endDate,
      };
      
      Object.keys(queryParams).forEach(key => {
        if (queryParams[key] === undefined) {
          delete queryParams[key];
        }
      });

      const response = await apiClient.get<any>('/transactions', queryParams);
      // Backend returns { success: true, data: [...], pagination: {...} }
      // But ApiResponse type doesn't include pagination, so we need to access it directly
      const pagination = (response as any).pagination;
      
      // We need to return { data: [...], pagination: {...} }
      if (response.success && response.data) {
        return {
          data: response.data,
          pagination: pagination || {
            nextCursor: null,
            hasMore: false,
          },
        } as PaginatedTransactionsResponse;
      }
      // Fallback: if response is already in the correct format
      return response as PaginatedTransactionsResponse;
    },
    onSuccess: (newData, variables) => {
      // Append new data to existing cache
      // Build query key without cursor to match the original query
      const { cursor: _cursor, ...queryParamsWithoutCursor } = variables;
      
      // Find all matching queries and update them
      // This handles the case where Date objects might not match exactly
      const queryCache = queryClient.getQueryCache();
      const allListQueries = queryCache.findAll({
        queryKey: ['transactions', 'list'],
        exact: false,
      });
      
      let updated = false;
      for (const query of allListQueries) {
        const queryParams = query.queryKey[2] as ListTransactionsParams | undefined;
        if (!queryParams) continue;
        
        // Check if params match (excluding cursor)
        const paramsMatch = 
          queryParams.householdId === queryParamsWithoutCursor.householdId &&
          queryParams.limit === queryParamsWithoutCursor.limit &&
          queryParams.search === queryParamsWithoutCursor.search &&
          queryParams.type === queryParamsWithoutCursor.type &&
          queryParams.categoryName === queryParamsWithoutCursor.categoryName &&
          queryParams.accountId === queryParamsWithoutCursor.accountId &&
          // Compare dates by converting to ISO strings
          (!queryParams.startDate || !queryParamsWithoutCursor.startDate || 
           new Date(queryParams.startDate).toISOString().split('T')[0] === 
           new Date(queryParamsWithoutCursor.startDate).toISOString().split('T')[0]) &&
          (!queryParams.endDate || !queryParamsWithoutCursor.endDate || 
           new Date(queryParams.endDate).toISOString().split('T')[0] === 
           new Date(queryParamsWithoutCursor.endDate).toISOString().split('T')[0]);
        
        if (paramsMatch) {
          const oldData = query.state.data as PaginatedTransactionsResponse | undefined;
          if (oldData) {
            const updatedData: PaginatedTransactionsResponse = {
              data: [...oldData.data, ...newData.data],
              pagination: newData.pagination,
            };
            queryClient.setQueryData(query.queryKey, updatedData);
            updated = true;
          }
        }
      }
      
      if (!updated) {
        // Fallback: try to update directly
        queryClient.setQueryData<PaginatedTransactionsResponse>(
          ['transactions', 'list', queryParamsWithoutCursor],
          (oldData) => {
            if (!oldData) return newData;
            return {
              data: [...oldData.data, ...newData.data],
              pagination: newData.pagination,
            };
          }
        );
      }
    },
  });
}

/**
 * Fetch all transactions for a date range using automatic pagination
 * This hook automatically loads all pages until all transactions are fetched
 */
export function useAllTransactions(params: ListTransactionsParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  const loadMoreMutation = useLoadMoreTransactions();

  // Base params with max limit
  const baseParams = useMemo(() => ({
    ...params,
    limit: 100, // Maximum allowed by backend
  }), [params]);

  // Initial query
  const { data: initialData } = useTransactions(baseParams);

  // State to accumulate all transactions
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasLoadedAll, setHasLoadedAll] = useState(false);

  // Load initial data
  useEffect(() => {
    if (initialData?.data) {
      setAllTransactions(initialData.data);
      setHasLoadedAll(!initialData.pagination?.hasMore);
    }
  }, [initialData]);

  // Load more transactions automatically if needed
  useEffect(() => {
    if (!initialData || hasLoadedAll || isLoadingMore || !initialData.pagination?.hasMore || !isAuthenticated) {
      return;
    }

    const loadAllPages = async () => {
      setIsLoadingMore(true);
      let currentCursor = initialData.pagination?.nextCursor;
      let accumulatedTransactions = [...initialData.data];

      while (currentCursor) {
        try {
          const result = await loadMoreMutation.mutateAsync({
            ...baseParams,
            cursor: currentCursor,
          });

          accumulatedTransactions = [...accumulatedTransactions, ...result.data];
          currentCursor = result.pagination?.nextCursor || null;

          if (!result.pagination?.hasMore || !currentCursor) {
            break;
          }
        } catch (error) {
          console.error('Error loading more transactions:', error);
          break;
        }
      }

      setAllTransactions(accumulatedTransactions);
      setHasLoadedAll(true);
      setIsLoadingMore(false);
    };

    loadAllPages();
  }, [initialData, hasLoadedAll, isLoadingMore, baseParams, loadMoreMutation, isAuthenticated]);

  // Reset when params change
  useEffect(() => {
    setAllTransactions([]);
    setHasLoadedAll(false);
    setIsLoadingMore(false);
  }, [baseParams.householdId, baseParams.startDate, baseParams.endDate, baseParams.month]);

  return allTransactions;
}

/**
 * Get transaction by ID
 */
export function useTransaction(transactionId: string) {
  return useQuery({
    queryKey: ['transactions', transactionId],
    queryFn: async () => {
      const response = await apiClient.get<Transaction>(`/transactions/${transactionId}`);
      return response.data!;
    },
    enabled: !!transactionId,
  });
}

/**
 * Get transaction summary
 */
export function useTransactionSummary(params: TransactionSummaryParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['transactions', 'summary', params],
    enabled: isAuthenticated && !!params.householdId && (!!params.startDate || !!params.endDate || !!params.month), // Permite usar month ou startDate/endDate
    queryFn: async () => {
      // Convert dates to YYYY-MM-DD format using local time (not UTC) to avoid timezone issues
      const queryParams: Record<string, unknown> = {
        householdId: params.householdId,
        ...(params.month && { month: params.month }),
        ...(params.startDate && { startDate: formatDateForAPI(params.startDate) }),
        ...(params.endDate && { endDate: formatDateForAPI(params.endDate) }),
      };
      
      const response = await apiClient.get<{ income: number; expenses: number; balance: number; transactionCount: number }>('/transactions/summary', queryParams);
      const backendSummary = response.data!;
      
      // Mapear resposta do backend para formato esperado pelo frontend
      return {
        income: backendSummary.income,
        expenses: backendSummary.expenses,
        balance: backendSummary.balance,
        transactionCount: backendSummary.transactionCount,
        // Campos calculados para compatibilidade
        totalIncome: backendSummary.income,
        totalExpense: backendSummary.expenses,
        period: {
          start: params.startDate ? formatDateForAPI(params.startDate) : (params.month ? `${params.month}-01` : ''),
          end: params.endDate ? formatDateForAPI(params.endDate) : (params.month ? `${params.month}-31` : ''),
        },
      } as TransactionSummary;
    },
  });
}

/**
 * Monthly recap data
 */
export interface MonthlyRecap {
  month: string;
  summary: {
    income: number;
    expenses: number;
    balance: number;
    transactionCount: number;
  };
  comparison: {
    incomeChange: number;
    expenseChange: number;
    balanceChange: number;
    prevIncome: number;
    prevExpenses: number;
    prevBalance: number;
  };
  topCategory: {
    categoryName: string;
    categoryDisplayName: string;
    total: number;
    count: number;
    color: string;
  } | null;
  largestExpense: {
    amount: number;
    description: string;
    categoryName: string | null;
    date: string;
  } | null;
  categoryBreakdown: Array<{
    categoryName: string;
    categoryDisplayName: string;
    total: number;
    count: number;
    color: string;
  }>;
}

export interface MonthlyRecapParams {
  householdId?: string;
  month?: string;
}

/**
 * Get monthly recap
 */
export function useMonthlyRecap(params: MonthlyRecapParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['transactions', 'monthly-recap', params],
    enabled: isAuthenticated && !!params.householdId,
    queryFn: async () => {
      const queryParams: Record<string, unknown> = {
        ...(params.householdId && { householdId: params.householdId }),
        ...(params.month && { month: params.month }),
      };
      
      const response = await apiClient.get<MonthlyRecap>('/transactions/monthly-recap', queryParams);
      return response.data!;
    },
  });
}

/**
 * Get spending by category
 */
export function useSpendingByCategory(params: TransactionSummaryParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['transactions', 'by-category', params],
    enabled: isAuthenticated && !!params.householdId && !!params.startDate && !!params.endDate, // Only fetch when authenticated and all params are available
    queryFn: async () => {
      // Convert dates to YYYY-MM-DD format using local time (not UTC) to avoid timezone issues
      const queryParams: Record<string, unknown> = {
        ...params,
        startDate: params.startDate ? formatDateForAPI(params.startDate) : params.startDate,
        endDate: params.endDate ? formatDateForAPI(params.endDate) : params.endDate,
      };
      const response = await apiClient.get<SpendingByCategory[]>('/transactions/by-category', queryParams);
      return response.data!;
    },
  });
}

/**
 * Create transaction mutation
 */
export function useCreateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string; // Optional - backend will create personal household if not provided
      description?: string;
      amount: number;
      categoryName: CategoryName;
      accountId?: string; // Optional - required for INCOME/EXPENSE, not for TRANSFER/ALLOCATION
      date: string;
      paid?: boolean;
      isSplit?: boolean; // Indicates if transaction is split between members
      splits?: Array<{ userId: string; amount: number }>; // Array of splits when isSplit is true
      recurringTransactionId?: string;
      installmentId?: string;
      installmentNumber?: number;
      totalInstallments?: number;
      attachmentUrl?: string;
    }) => {
      const response = await apiClient.post<Transaction>('/transactions', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // Invalidate auth/me to refresh household list
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update transaction mutation
 */
export function useUpdateTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Transaction>) => {
      const response = await apiClient.patch<Transaction>(`/transactions/${id}`, data);
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Delete transaction mutation
 */
export function useDeleteTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transactionId: string) => {
      await apiClient.delete(`/transactions/${transactionId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Batch create transactions mutation
 */
export function useBatchCreateTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string; // Optional - backend will create personal household if not provided
      transactions: Array<{
        description?: string;
        amount: number;
        categoryName: CategoryName | string;
        accountId: string;
        date: string;
        paid?: boolean;
        installmentId?: string;
        installmentNumber?: number;
        totalInstallments?: number;
      }>;
    }) => {
      const response = await apiClient.post<{ created: number; transactions: Transaction[] }>('/transactions/batch', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      // Invalidate auth/me to refresh household list
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Batch delete transactions mutation
 */
export function useBatchDeleteTransactions() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId: string;
      transactionIds: string[];
    }) => {
      const response = await apiClient.delete<{ deleted: number }>('/transactions/batch', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'by-category'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'heatmap'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

export interface CreditCardInvoiceResponse {
  invoiceTransactions: Transaction[];
  currentExpenses: number;
  currentPayments: number;
  total: number;
  previousBalance: number;
  isPaid: boolean;
  paymentTransactions: Transaction[];
}

export interface CreditCardInvoiceParams {
  accountId: string | null;
  month: string;
  householdId?: string;
  limit?: number;
  cursor?: string;
}

/**
 * Cache key of one invoice listing. "Load more" appends to the entry of the first page, so both must build
 * the key here: an array with `undefined` hashes as `null`, and a key that merely omits the cursor is a
 * different cache entry that nothing renders.
 */
export function creditCardInvoiceKey({ accountId, month, householdId, limit, cursor }: CreditCardInvoiceParams) {
  return ['transactions', 'credit-card-invoice', accountId, month, householdId ?? null, limit ?? null, cursor ?? null] as const;
}

/**
 * Get credit card invoice for a specific month
 */
export function useCreditCardInvoice(params: CreditCardInvoiceParams) {
  const { accountId, month, householdId, limit, cursor } = params;
  
  return useQuery({
    queryKey: creditCardInvoiceKey(params),
    queryFn: async () => {
      if (!accountId) return null;
      const queryParams: Record<string, unknown> = {
        ...(householdId && { householdId }),
        ...(limit && { limit }),
        ...(cursor && { cursor }),
      };
      const response = await apiClient.get<CreditCardInvoiceResponse>(
        `/transactions/credit-cards/${accountId}/invoice/${month}`,
        queryParams
      );
      return {
        data: response.data!,
        pagination: (response as any).pagination || {
          nextCursor: null,
          hasMore: false,
        },
      };
    },
    enabled: !!accountId && !!month,
  });
}

/**
 * Append a "load more" page to the cached first page, the entry the invoice view renders (same key, no cursor).
 */
export function appendCreditCardInvoicePage(
  queryClient: QueryClient,
  variables: CreditCardInvoiceParams,
  newData: { data: CreditCardInvoiceResponse; pagination: { nextCursor: string | null; hasMore: boolean } }
) {
  queryClient.setQueryData(creditCardInvoiceKey({ ...variables, cursor: undefined }), (oldData: any) => {
    if (!oldData) return { data: newData.data, pagination: newData.pagination };

    return {
      data: {
        ...oldData.data,
        invoiceTransactions: [...oldData.data.invoiceTransactions, ...newData.data.invoiceTransactions],
      },
      pagination: newData.pagination,
    };
  });
}

/**
 * Load more credit card invoice transactions
 */
export function useLoadMoreCreditCardInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreditCardInvoiceParams & { cursor: string }) => {
      const { accountId, month, householdId, limit, cursor } = params;
      if (!accountId) throw new Error('accountId is required');
      
      const queryParams: Record<string, unknown> = {
        ...(householdId && { householdId }),
        ...(limit && { limit }),
        cursor,
      };
      
      const response = await apiClient.get<CreditCardInvoiceResponse>(
        `/transactions/credit-cards/${accountId}/invoice/${month}`,
        queryParams
      );
      
      return {
        data: response.data!,
        pagination: (response as any).pagination || {
          nextCursor: null,
          hasMore: false,
        },
      };
    },
    onSuccess: (newData, variables) => appendCreditCardInvoicePage(queryClient, variables, newData),
  });
}

/**
 * Pay credit card invoice mutation
 */
export function usePayCreditCardInvoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      accountId: string;
      sourceAccountId: string;
      amount?: number;
      month: string;
      description?: string;
      householdId?: string;
    }) => {
      const response = await apiClient.post<{ success: boolean }>(
        `/transactions/credit-cards/${data.accountId}/pay-invoice`,
        {
          sourceAccountId: data.sourceAccountId,
          amount: data.amount,
          month: data.month,
          description: data.description,
          householdId: data.householdId,
        }
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'credit-card-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Undo credit card payment mutation
 */
export function useUndoCreditCardPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      accountId: string;
      transactionId: string;
    }) => {
      const response = await apiClient.delete<{ success: boolean }>(
        `/transactions/credit-cards/${data.accountId}/undo-payment/${data.transactionId}`
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'credit-card-invoice'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Create transfer mutation
 */
export function useCreateTransfer() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string;
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      description?: string;
      date: string;
      notes?: string;
    }) => {
      const response = await apiClient.post<Transaction>('/transactions/transfers', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Create allocation mutation
 */
export function useCreateAllocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string;
      accountId: string;
      creditCardId: string;
      amount: number;
      description?: string;
      date: string;
      notes?: string;
    }) => {
      const response = await apiClient.post<Transaction>('/transactions/allocations', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Create deallocation mutation
 */
export function useCreateDeallocation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string;
      accountId: string;
      creditCardId: string;
      amount: number;
      description?: string;
      date: string;
      notes?: string;
    }) => {
      const response = await apiClient.post<Transaction>('/transactions/deallocations', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Invalidate all dashboard data
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

/**
 * Get transaction splits
 */
export function useTransactionSplits(transactionId: string, householdId?: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['transactions', transactionId, 'splits', householdId],
    enabled: isAuthenticated && !!transactionId && !!householdId,
    queryFn: async () => {
      const response = await apiClient.get<TransactionSplit[]>(
        `/transactions/${transactionId}/splits`,
        householdId ? { householdId } : {}
      );
      return response.data!;
    },
  });
}

/**
 * Update transaction split (mark as paid/unpaid)
 */
export function useUpdateTransactionSplit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ splitId, paid }: { splitId: string; paid: boolean }) => {
      const response = await apiClient.patch<TransactionSplit>(
        `/transactions/splits/${splitId}`,
        { paid }
      );
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', data.transactionId, 'splits'] });
      queryClient.invalidateQueries({ queryKey: ['transactions', data.transactionId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Heatmap data response from backend
 */
export interface HeatmapData {
  month: string;
  data: Array<{ day: number; amount: number }>;
  total: number;
  daysInMonth: number;
}

export interface HeatmapParams {
  householdId?: string;
  month?: string; // YYYY-MM format
}

/**
 * Get spending heatmap data for a month
 * Uses optimized backend endpoint that aggregates spending by day
 * 
 * Cache strategy:
 * - staleTime: 30 minutes - data is considered fresh for 30 minutes
 * - gcTime: 1 hour - cached data kept for 1 hour before garbage collection
 * - refetchOnWindowFocus: false - no refetch when switching tabs
 * - refetchOnMount: false - reuses cached data when component remounts
 * - Cache is invalidated automatically when transactions are created/updated/deleted
 */
export function useSpendingHeatmap(params: HeatmapParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['transactions', 'heatmap', params],
    enabled: isAuthenticated && !!params.householdId,
    staleTime: 30 * 60 * 1000, // 30 minutes - heatmap data doesn't change often
    gcTime: 60 * 60 * 1000, // 1 hour - keep cached data longer
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Reuse cached data when component remounts
    refetchOnReconnect: false, // Don't refetch on reconnect
    queryFn: async () => {
      const queryParams: Record<string, string> = {};
      
      if (params.householdId) {
        queryParams.householdId = params.householdId;
      }
      if (params.month) {
        queryParams.month = params.month;
      }

      const response = await apiClient.get<HeatmapData>('/transactions/heatmap', queryParams);
      return response.data!;
    },
  });
}

/**
 * Dashboard Overview data types
 */
export interface DashboardSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export interface DashboardTrend {
  incomeChange: number;
  expenseChange: number;
  balanceChange: number;
  incomeTrend: 'up' | 'down' | 'stable';
  expenseTrend: 'up' | 'down' | 'stable';
}

export interface DashboardForecast {
  predictedIncome: number;
  predictedExpense: number;
  predictedBalance: number;
}

export interface CategoryBreakdown {
  name: string;
  income: number;
  expense: number;
  total: number;
}

export interface MonthlyComparisonItem {
  month: string;
  income: number;
  expense: number;
}

export interface BalanceEvolutionItem {
  month: string;
  balance: number;
}

export interface FixedVsVariable {
  fixed: number;
  variable: number;
  fixedPercentage: number;
  variablePercentage: number;
}

export interface BudgetVsRealized {
  category: string;
  type: 'INCOME' | 'EXPENSE';
  budgeted: number;
  spent: number;
  remaining: number;
  percentage: number;
  status: 'ok' | 'warning' | 'exceeded';
}

export interface DashboardOverviewData {
  summary: DashboardSummary;
  trend: DashboardTrend;
  forecast: DashboardForecast;
  categoryBreakdown: CategoryBreakdown[];
  monthlyComparison: MonthlyComparisonItem[];
  balanceEvolution: BalanceEvolutionItem[];
  fixedVsVariable: FixedVsVariable;
  budgetVsRealized: BudgetVsRealized[];
  heatmap: HeatmapData;
}

export interface DashboardOverviewParams {
  householdId?: string;
  month: string; // YYYY-MM format
}

/**
 * Get complete dashboard overview with all aggregated data
 * This single endpoint replaces multiple individual data fetches
 * 
 * Cache strategy:
 * - staleTime: 5 minutes - data is considered fresh for 5 minutes
 * - gcTime: 30 minutes - cached data kept for 30 minutes before garbage collection
 * - refetchOnWindowFocus: true - refetch when user comes back to tab
 * - Cache is invalidated automatically when transactions are created/updated/deleted
 */
export function useDashboardOverview(params: DashboardOverviewParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['dashboard', 'overview', params],
    enabled: isAuthenticated && !!params.householdId && !!params.month,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    queryFn: async () => {
      const queryParams: Record<string, string> = {
        month: params.month,
      };
      
      if (params.householdId) {
        queryParams.householdId = params.householdId;
      }

      const response = await apiClient.get<DashboardOverviewData>('/dashboard/overview', queryParams);
      return response.data!;
    },
  });
}
