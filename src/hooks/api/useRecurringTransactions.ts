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
  /** The amount follows the most recent occurrence the user adjusts. Absent on a server that predates it. */
  followLastAmount?: boolean;
  /** YYYY-MM-DD of the newest occurrence up to today + 31 days; null when none; absent on an older server. */
  lastOccurrenceDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Sent back by the transaction update when it changed the amount of the recurrence the transaction belongs to. */
export interface RecurringUpdatedNotice {
  id: string;
  amount: number;
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
      followLastAmount?: boolean;
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
 * Execute recurring transaction mutation
 */
export function useExecuteRecurringTransaction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ recurringId, ...data }: { recurringId: string; date?: string; amount?: number }) => {
      const response = await apiClient.post<{ transaction: Transaction; recurringTransaction: RecurringTransaction }>(
        `/recurring-transactions/${recurringId}/execute`,
        data
      );
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions', 'due'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
    },
  });
}

