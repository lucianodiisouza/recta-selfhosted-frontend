import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { CategoryType, RecurrenceFrequency, CategoryName } from '../../lib/enums';
import type { Transaction } from './useTransactions';

export interface RecurringTransaction {
  id: string;
  householdId: string;
  description: string;
  amount: number;
  categoryName: CategoryName;
  accountId: string;
  frequency: RecurrenceFrequency;
  startDate: string;
  endDate?: string;
  nextRunAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ListRecurringTransactionsParams {
  householdId: string;
  isActive?: boolean;
  type?: CategoryType;
}

/**
 * List recurring transactions
 */
export interface RecurringTransactionsResponse {
  success: boolean;
  data: RecurringTransaction[];
}

export function useRecurringTransactions(params: ListRecurringTransactionsParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['recurring-transactions', params],
    queryFn: async () => {
      const response = await apiClient.get<RecurringTransactionsResponse>('/recurring-transactions', params);
      return response.data!;
    },
    enabled: isAuthenticated && !!params.householdId, // Only fetch when authenticated and householdId is available
  });
}

/**
 * Get recurring transactions that are due
 */
export function useDueRecurringTransactions(householdId: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['recurring-transactions', 'due', householdId],
    queryFn: async () => {
      const response = await apiClient.get<RecurringTransaction[]>('/recurring-transactions/due', { householdId });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId, // Only fetch when authenticated and householdId is available
  });
}

/**
 * A future occurrence of an active recurring transaction, computed by the backend.
 * Read-only: it is not a transaction and never touches balances (fdbk #116).
 */
export interface RecurringProjection {
  /** "<recurringTransactionId>:<YYYY-MM-DD>" */
  id: string;
  projected: true;
  /** True only on the rule's next due date: the one occurrence POST /:id/execute launches. */
  isNext?: boolean;
  recurringTransactionId: string;
  /** YYYY-MM-DD */
  date: string;
  type: 'INCOME' | 'EXPENSE';
  /** Always positive; the sign comes from `type`. */
  amount: number;
  categoryName: string;
  description: string | null;
  accountId: string;
  account?: { id: string; name: string; type: string } | null;
  frequency: RecurrenceFrequency | string;
}

/**
 * Projected occurrences of the active recurring transactions between `from` and `to`
 * (YYYY-MM-DD, inclusive, max 400 days).
 */
export function useRecurringProjections(params: { householdId?: string; from: string; to: string }, options?: { enabled?: boolean }) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;

  return useQuery({
    queryKey: ['recurring-transactions', 'projections', params],
    queryFn: async () => {
      const response = await apiClient.get<RecurringProjection[]>('/recurring-transactions/projections', params);
      return (response.data ?? []).map((p) => ({
        ...p,
        amount: Math.abs(typeof p.amount === 'string' ? parseFloat(p.amount) : Number(p.amount)) || 0,
      }));
    },
    enabled: isAuthenticated && !!params.householdId && (options?.enabled ?? true),
  });
}

/**
 * Get recurring transaction by ID
 */
export function useRecurringTransaction(recurringId: string) {
  return useQuery({
    queryKey: ['recurring-transactions', recurringId],
    queryFn: async () => {
      const response = await apiClient.get<RecurringTransaction>(`/recurring-transactions/${recurringId}`);
      return response.data!;
    },
    enabled: !!recurringId,
  });
}

/**
 * Create recurring transaction mutation
 */
export function useCreateRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string; // Optional - backend will create personal household if not provided
      description?: string;
      amount: number;
      categoryName: CategoryName;
      accountId: string;
      frequency: RecurrenceFrequency;
      startDate: string;
      nextRunAt: string;
      endDate?: string;
      isActive?: boolean;
    }) => {
      const response = await apiClient.post<RecurringTransaction>('/recurring-transactions', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      // Invalidate auth/me to refresh household list
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update recurring transaction mutation
 */
export function useUpdateRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<RecurringTransaction>) => {
      const response = await apiClient.patch<RecurringTransaction>(`/recurring-transactions/${id}`, data);
      return response.data!;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', 'due'] });
    },
  });
}

/**
 * Delete recurring transaction mutation
 */
export function useDeleteRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (recurringId: string) => {
      const response = await apiClient.delete<{ id: string }>(`/recurring-transactions/${recurringId}`);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', 'due'] });
    },
  });
}

/**
 * Execute recurring transaction mutation.
 * `date` (YYYY-MM-DD, local) and `paid` are optional; the backend creates the real transaction
 * on that date and advances `nextRunAt` keeping the due day (fdbk #116).
 */
export function useExecuteRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recurringId, ...data }: { recurringId: string; date?: string; amount?: number; paid?: boolean }) => {
      const response = await apiClient.post<{ transaction: Transaction; nextRunAt: string }>(
        `/recurring-transactions/${recurringId}/execute`,
        data
      );
      return response.data!;
    },
    onSuccess: () => {
      // Also covers ['recurring-transactions', 'projections', ...]
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['budgets', 'summary'] });
    },
  });
}
