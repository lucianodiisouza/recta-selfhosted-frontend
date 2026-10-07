import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

import { AccountType } from '../../constants/accountTypes';

export interface Account {
  id: string;
  householdId: string;
  name: string;
  type: AccountType;
  balance: number; // Legacy field
  totalBalance?: number;
  availableBalance?: number;
  allocatedBalance?: number;
  color?: string;
  icon?: string;
  creditLimit?: number;
  totalLimit?: number;
  availableLimit?: number;
  dueDay?: number;
  closingDay?: number;
  bestDayOffset?: number;
  linkedAccountId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  // For available accounts endpoint and list accounts (when using personal accounts in shared household)
  isPersonal?: boolean;
  accountOwnerId?: string | null; // null for household accounts, userId for shared personal accounts
}

export interface AccountsSummary {
  totalBalance: number;
  totalCreditLimit?: number;
  totalAvailableCredit?: number;
  accountsByType: Record<string, number>;
}

export interface ListAccountsParams {
  householdId: string;
  type?: Account['type'];
  includeInactive?: boolean;
}

/**
 * List accounts
 */
export interface AccountsListResponse {
  accounts: Account[];
  totals: Array<{
    currency: string;
    amount: number;
  }>;
}

export function useAccounts(params: ListAccountsParams) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['accounts', params],
    queryFn: async () => {
      const response = await apiClient.get<AccountsListResponse>('/accounts', params);
      return response.data!;
    },
    enabled: isAuthenticated && !!params.householdId, // Only fetch when authenticated and householdId is available
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Sempre considerar stale para garantir refetch após mutações
  });
}

/**
 * Get account by ID
 */
export function useAccount(accountId: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['accounts', accountId],
    queryFn: async () => {
      const response = await apiClient.get<Account>(`/accounts/${accountId}`);
      return response.data!;
    },
    enabled: isAuthenticated && !!accountId, // Only fetch when authenticated and accountId is available
  });
}

/**
 * Get accounts summary
 */
export function useAccountsSummary(householdId: string) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['accounts', 'summary', householdId],
    queryFn: async () => {
      const response = await apiClient.get<AccountsSummary>('/accounts/summary', { householdId });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId, // Only fetch when authenticated and householdId is available
  });
}

/**
 * List available accounts for creating a transaction in a household
 * Returns accounts from the household + personal accounts (if allowed)
 * This endpoint respects allowPersonalAccountAccess permissions
 */
export interface AvailableAccountsResponse {
  accounts: Account[];
  hasPersonalAccounts: boolean;
}

export function useAvailableAccounts(householdId: string, includeInactive = false) {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['accounts', 'available', householdId, includeInactive],
    queryFn: async () => {
      const response = await apiClient.get<AvailableAccountsResponse>('/accounts/available', {
        householdId,
        includeInactive,
      });
      return response.data!;
    },
    enabled: isAuthenticated && !!householdId, // Only fetch when authenticated and householdId is available
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 0, // Always consider stale to get fresh permissions
  });
}

/**
 * Create account mutation
 */
export function useCreateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string; // Optional - backend will create personal household if not provided
      name: string;
      type: Account['type'];
      balance?: number;
      color?: string;
      icon?: string;
      creditLimit?: number;
      dueDay?: number;
      closingDay?: number;
      bestDayOffset?: number;
    }) => {
      const response = await apiClient.post<Account>('/accounts', data);
      return response.data!;
    },
    onSuccess: (newAccount) => {
      // Atualizar otimisticamente o cache com a nova conta
      // Isso garante que a conta apareça imediatamente mesmo antes do refetch
      const accountHouseholdId = newAccount.householdId;
      
      if (accountHouseholdId) {
        // Atualizar otimisticamente a query específica
        queryClient.setQueryData<AccountsListResponse>(
          ['accounts', { householdId: accountHouseholdId }],
          (oldData) => {
            if (!oldData) {
              // Se não há dados antigos, criar novo objeto
              return {
                accounts: [newAccount],
                totals: []
              };
            }
            
            // Verificar se a conta já existe para evitar duplicatas
            const exists = oldData.accounts?.some(acc => acc.id === newAccount.id);
            if (exists) {
              return oldData;
            }
            
            // Adicionar a nova conta à lista existente
            return {
              ...oldData,
              accounts: [...(oldData.accounts || []), newAccount],
            };
          }
        );
      }
      
      // Invalidar todas as queries para garantir refetch em background
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] });
      // Invalidate auth/me to refresh household list
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update account mutation
 */
export function useUpdateAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Account>) => {
      const response = await apiClient.patch<Account>(`/accounts/${id}`, data);
      return response.data!;
    },
    onSuccess: (data) => {
      // Atualização otimista do cache
      queryClient.setQueriesData<AccountsListResponse>(
        { queryKey: ['accounts'] },
        (oldData) => {
          if (!oldData || !oldData.accounts) return oldData;
          
          const updatedAccounts = oldData.accounts.map(acc => 
            acc.id === data.id ? { ...acc, ...data, balance: Number(data.balance) } : acc
          );
          
          return {
            ...oldData,
            accounts: updatedAccounts,
          };
        }
      );
      
      // Invalidar queries para garantir refetch em background
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', data.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary', data.householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
    onError: (_error) => {
      // Error updating account
    },
  });
}

/**
 * Delete account mutation
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      variables: string | { accountId: string; deleteTransactions?: boolean }
    ) => {
      // Support both the legacy string signature and the new options object.
      const accountId = typeof variables === 'string' ? variables : variables.accountId;
      const deleteTransactions =
        typeof variables === 'string' ? false : variables.deleteTransactions ?? false;

      const query = deleteTransactions ? '?deleteTransactions=true' : '';
      const response = await apiClient.delete<{
        id: string;
        householdId: string;
        deletedTransactions: number;
      }>(`/accounts/${accountId}${query}`);
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', data.id] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary', data.householdId] });
      // Linked transactions may have been deleted (or set to NULL); refresh them too.
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Transfer between accounts mutation
 */
export function useTransferBetweenAccounts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      description?: string;
    }) => {
      const response = await apiClient.post<{ transactions: any[] }>('/accounts/transfer', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

/**
 * Adjust account balance mutation
 */
export function useAdjustAccountBalance() {
  const queryClient = useQueryClient();

  return useMutation({
    // The server answers { account, adjustment }: adjustment is null when the account already had the target balance.
    // `date` (YYYY-MM-DD, not in the future) dates the entry; an opening balance goes at the end of the previous year.
    mutationFn: async ({ accountId, ...data }: { accountId: string; newBalance: number; date?: string; reason?: string }) => {
      const response = await apiClient.post<{ account: Account; adjustment: { id: string; amount: number; date?: string } | null }>(
        `/accounts/${accountId}/adjust-balance`,
        data,
      );
      return response.data!;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['accounts', variables.accountId] });
      queryClient.invalidateQueries({ queryKey: ['accounts', 'summary', data.account?.householdId] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

