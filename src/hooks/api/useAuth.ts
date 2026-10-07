import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient, isNetworkError } from '../../utils/api';
import { useAuth } from '../../context/AuthContext';
import { saveHouseholdToLocalStorage, loadHouseholdFromLocalStorage } from '../../utils/householdStorage';

export interface User {
  id: string;
  email: string;
  firebaseUid: string | null;
  createdAt: string;
  households: Household[];
}

export interface Household {
  id: string;
  name: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  joinedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get current authenticated user
 */
export function useAuthUser() {
  const { currentUser } = useAuth();
  const isAuthenticated = !!currentUser;
  
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      const response = await apiClient.get<User>('/auth/me');
      const userData = response.data!;
      return userData;
    },
    enabled: isAuthenticated, // Only fetch when user is authenticated
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: true, // Allow refetch on mount to ensure fresh data after sync
    refetchOnReconnect: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Retry function with exponential backoff for network errors
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Only retry on network errors
      if (!isNetworkError(error) || attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Sync Firebase user with backend
 * Now creates personal household automatically if it doesn't exist
 * Includes retry logic with exponential backoff for network errors
 * Optionally accepts referralCode to process referral
 */
export function useSyncAuth() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (referralCode?: string) => {
      return retryWithBackoff(async () => {
        // apiClient.post returns ApiResponse<T> which has structure { success: boolean, data?: T }
        // Fastify requires an object, so send empty object if no referralCode
        const response = await apiClient.post<{ id: string; email: string; emailVerified: boolean; createdAt: string; householdId?: string }>(
          '/auth/sync',
          referralCode ? { referralCode } : {}
        );
        
        if (!response.success) {
          throw new Error('Sync failed');
        }
        
        // response.data is the user data object (based on logs: { id, email, householdId, ... })
        if (!response.data) {
          throw new Error('No data in response');
        }
        
        return response.data;
      }, 3, 1000); // 3 retries with 1s initial delay
    },
    onSuccess: async (data) => {
      if (!data) {
        return;
      }

      // IMPORTANT: Only save householdId if localStorage is empty (first-time user)
      // Never overwrite user's existing selection - respect their choice
      // The backend returns householdId to help first-time users, but we should not
      // override a user's explicit selection after they've chosen a household
      const existingHousehold = loadHouseholdFromLocalStorage();
      if (!existingHousehold?.id && data.householdId) {
        // Only save if there's no existing household selection (first login/signup)
        saveHouseholdToLocalStorage(data.householdId);
      }
      // If existingHousehold exists, do nothing - respect user's choice
      
      // Invalidate and refetch auth/me to fetch updated user data including the newly created household
      // This is safe because sync only runs on login/signup, not continuously
      await queryClient.refetchQueries({ queryKey: ['auth', 'me'] });
    },
    retry: false, // We handle retries manually with exponential backoff
  });
}

