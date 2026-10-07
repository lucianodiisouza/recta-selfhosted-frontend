import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';

export interface User {
  id: string;
  email: string;
  firebaseUid: string | null;
  displayName?: string | null;
  isPremium?: boolean;
  onboardingCompleted?: boolean;
  onboardingRestartedAt?: string | null;
  theme?: 'light' | 'dark' | null;
  baseCurrency?: string | null;
  locale?: string | null;
  country?: string | null;
  referralCode?: string | null;
  dashboardPreferences?: Record<string, unknown>;
  lastRecurringProcessedMonth?: string | null;
  lastRecurringProcessedAt?: string | null;
  preferencesUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

const USER_STORAGE_KEY = 'user_data';
const USER_STORAGE_TIMESTAMP_KEY = 'user_data_timestamp';

/**
 * Salvar dados do usuário no localStorage
 */
function saveUserToLocalStorage(user: User): void {
  try {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    localStorage.setItem(USER_STORAGE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    // Error saving user data to localStorage
  }
}

/**
 * Carregar dados do usuário do localStorage
 */
function loadUserFromLocalStorage(): User | null {
  try {
    const userData = localStorage.getItem(USER_STORAGE_KEY);
    if (!userData) return null;
    
    const user = JSON.parse(userData) as User;
    
    // Verificar se os dados não estão muito antigos (mais de 1 hora)
    const timestamp = localStorage.getItem(USER_STORAGE_TIMESTAMP_KEY);
    if (timestamp) {
      const age = Date.now() - parseInt(timestamp, 10);
      const oneHour = 60 * 60 * 1000;
      if (age > oneHour) {
        // Dados muito antigos, considerar inválidos
        return null;
      }
    }
    
    return user;
  } catch (error) {
    return null;
  }
}

/**
 * Limpar dados do usuário do localStorage
 */
export function clearUserFromLocalStorage(): void {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_TIMESTAMP_KEY);
  } catch (error) {
    // Error clearing user data from localStorage
  }
}

export interface UserPreferences {
  displayName?: string;
  theme?: 'light' | 'dark';
  baseCurrency?: string;
  locale?: string;
  country?: string;
  currency?: string; // Alias para baseCurrency para compatibilidade
  onboardingCompleted?: boolean;
  dashboardPreferences?: Record<string, unknown>;
  [key: string]: any;
}

/**
 * Get current user info
 */
export function useUser() {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  // Carregar dados do localStorage APENAS se estiver autenticado
  // Isso evita usar dados de usuários anteriores após logout
  const cachedUser = isAuthenticated ? loadUserFromLocalStorage() : null;
  
  // Obter timestamp do cache se existir
  const getCacheTimestamp = (): number | undefined => {
    if (!isAuthenticated) return undefined;
    try {
      const timestamp = localStorage.getItem(USER_STORAGE_TIMESTAMP_KEY);
      return timestamp ? parseInt(timestamp, 10) : undefined;
    } catch {
      return undefined;
    }
  };
  
  const cacheTimestamp = getCacheTimestamp();
  
  return useQuery({
    queryKey: ['users', 'me'],
    queryFn: async () => {
      const response = await apiClient.get<User>('/users/me');
      const userData = response.data!;
      
      // Salvar no localStorage após buscar da API
      saveUserToLocalStorage(userData);
      
      return userData;
    },
    enabled: isAuthenticated, // Only fetch when user is authenticated
    // Usar placeholderData APENAS se estiver autenticado e tiver cache válido
    // Isso evita mostrar dados de usuários anteriores após logout
    placeholderData: (isAuthenticated && cachedUser) ? cachedUser : undefined,
    retry: false,
    refetchOnWindowFocus: false,
    // Se temos dados em cache recentes (menos de 5 minutos), não fazer refetch no mount
    refetchOnMount: !cachedUser || !cacheTimestamp || (Date.now() - cacheTimestamp) > 5 * 60 * 1000,
    refetchOnReconnect: true, // Refetch quando reconectar para garantir dados atualizados
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Get or create referral code
 */
export function useReferralCode() {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['users', 'me', 'referral-code'],
    queryFn: async () => {
      const response = await apiClient.get<{ referralCode: string; referralCount: number }>('/users/me/referral-code');
      return response.data!;
    },
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Update user preferences mutation
 */
export function useUpdateUserPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: UserPreferences) => {
      const response = await apiClient.put<User>('/users/me/preferences', preferences);
      return response.data!;
    },
    onSuccess: (data) => {
      // Atualizar cache diretamente em vez de invalidar para evitar refetch
      // Atualizar tanto ['users', 'me'] quanto ['auth', 'me'] se existir
      queryClient.setQueryData(['users', 'me'], data);
      // IMPORTANT: '/users/me' doesn't include households, but '/auth/me' does.
      // Never overwrite auth/me with a shape that drops households; merge instead.
      queryClient.setQueryData(['auth', 'me'], (prev: User | undefined) => {
        if (!prev) return prev;
        return { ...prev, ...data };
      });
      
      // Atualizar localStorage com os dados atualizados
      saveUserToLocalStorage(data);
    },
  });
}

/**
 * Reset user account mutation
 * This will delete all user data but keep the user account
 */
export function useResetUserAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.post<{ success: boolean }>('/users/me/reset');
      return response.data!;
    },
    onSuccess: () => {
      // Invalidate all queries since data is being reset
      queryClient.clear();
    },
  });
}

/**
 * Delete user account mutation
 * This will delete the user from the backend and Firebase Auth
 */
export function useDeleteUserAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await apiClient.delete<{ success: boolean }>('/users/me');
      return response.data!;
    },
    onSuccess: () => {
      // Invalidate all queries since user is being deleted
      queryClient.clear();
    },
  });
}

