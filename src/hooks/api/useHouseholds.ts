import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';

export interface Household {
  id: string;
  name: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHouseholdInput {
  name: string;
}

/**
 * List all households the user is a member of
 */
export function useHouseholds() {
  return useQuery({
    queryKey: ['households'],
    queryFn: async () => {
      const response = await apiClient.get<Household[]>('/households');
      
      // API returns { success: true, data: Household[] }
      const households = response.success && response.data ? response.data : [];
      
      // Filter out any invalid households (empty objects or those without id)
      // Normalize the data to ensure consistent structure
      const validHouseholds: Household[] = [];
      
      for (const h of households) {
        // Filter out null, undefined, non-objects, and empty objects
        if (!h || typeof h !== 'object' || Array.isArray(h)) {
          continue;
        }
        
        const keys = Object.keys(h);
        if (keys.length === 0) {
          // Empty object - this shouldn't happen with the fixed schema, but let's be safe
          continue;
        }
        
        // Must have id property
        if (!('id' in h) || !h.id) {
          continue;
        }
        
        // id must be a non-empty string
        const id = String(h.id);
        if (!id || id.length === 0) {
          continue;
        }
        
        // Normalize the household object
        const normalizedHousehold: Household = {
          id,
          name: 'name' in h ? String(h.name || '') : '',
          role: ('role' in h && (h.role === 'OWNER' || h.role === 'EDITOR' || h.role === 'VIEWER')) 
            ? h.role as 'OWNER' | 'EDITOR' | 'VIEWER'
            : 'VIEWER',
          createdAt: 'createdAt' in h && h.createdAt 
            ? (typeof h.createdAt === 'string' ? h.createdAt : new Date(h.createdAt).toISOString())
            : new Date().toISOString(),
          updatedAt: 'updatedAt' in h && h.updatedAt
            ? (typeof h.updatedAt === 'string' ? h.updatedAt : new Date(h.updatedAt).toISOString())
            : new Date().toISOString(),
          joinedAt: 'joinedAt' in h && h.joinedAt
            ? (typeof h.joinedAt === 'string' ? h.joinedAt : new Date(h.joinedAt).toISOString())
            : ('createdAt' in h && h.createdAt
              ? (typeof h.createdAt === 'string' ? h.createdAt : new Date(h.createdAt).toISOString())
              : new Date().toISOString()),
        };
        
        validHouseholds.push(normalizedHousehold);
      }
      
      return validHouseholds;
    },
  });
}

/**
 * Get household by ID
 */
export function useHousehold(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId],
    queryFn: async () => {
      const response = await apiClient.get<Household>(`/households/${householdId}`);
      return response.data!;
    },
    enabled: !!householdId,
  });
}

/**
 * Create a new household (shared finances)
 */
export function useCreateHousehold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateHouseholdInput) => {
      const response = await apiClient.post<Household>('/households', data);
      return response.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update household details (OWNER only)
 */
export function useUpdateHousehold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, ...data }: { householdId: string } & Partial<CreateHouseholdInput>) => {
      const response = await apiClient.patch<Household>(`/households/${householdId}`, data);
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['households', data.id] });
    },
  });
}

/**
 * Delete household (OWNER only)
 */
export function useDeleteHousehold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdId: string) => {
      await apiClient.delete(`/households/${householdId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      // Dados da household deletada (contas, transações, orçamentos, etc.) ficam stale;
      // invalidar para que, ao trocar de household, os dados corretos sejam buscados.
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
    },
  });
}

export interface HouseholdMember {
  id: string;
  householdId: string;
  userId: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  allowPersonalAccountAccess?: boolean;
  sharedAccountIds?: string[]; // Array of account IDs that this member has specifically chosen to share
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    createdAt: string;
  };
}

export interface InviteMemberInput {
  email: string;
  role: 'EDITOR' | 'VIEWER';
}

/**
 * Get all members of a household
 */
export function useHouseholdMembers(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'members'],
    queryFn: async () => {
      const response = await apiClient.get<HouseholdMember[]>(`/households/${householdId}/members`);
      const members = response.success && response.data ? response.data : [];
      
      // Filter out invalid members (empty objects or those without user)
      const validMembers = members.filter((m) => {
        if (!m || typeof m !== 'object') return false;
        if (Object.keys(m).length === 0) return false; // Empty object
        if (!m.id || !m.user || !m.user.email) return false;
        return true;
      });
      
      return validMembers;
    },
    enabled: !!householdId,
  });
}

/**
 * Invite a member to household (OWNER only)
 */
export function useInviteMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, ...data }: { householdId: string } & InviteMemberInput) => {
      const response = await apiClient.post<HouseholdInvite>(`/households/${householdId}/invite`, data);
      
      // API returns { success: true, data: HouseholdInvite }
      const invite = response.success && response.data ? response.data : null;
      
      return invite!;
    },
    onSuccess: (_data, variables) => {
      // Invalidate household invites list (for modal - to show pending invite)
      queryClient.invalidateQueries({ queryKey: ['households', variables.householdId, 'invites'] });
      // Invalidate members list (in case it's cached)
      queryClient.invalidateQueries({ queryKey: ['households', variables.householdId, 'members'] });
      // Invalidate household data
      queryClient.invalidateQueries({ queryKey: ['households', variables.householdId] });
      // Invalidate pending invites for the invitee (if they're logged in)
      queryClient.invalidateQueries({ queryKey: ['households', 'invites', 'pending'] });
    },
  });
}

/**
 * Update member role (OWNER only)
 */
export function useUpdateMemberRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      householdId, 
      memberId, 
      role 
    }: { 
      householdId: string; 
      memberId: string; 
      role: 'EDITOR' | 'VIEWER' 
    }) => {
      const response = await apiClient.patch<HouseholdMember>(
        `/households/${householdId}/members/${memberId}`, 
        { role }
      );
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'members'] });
    },
  });
}

/**
 * Remove a member from household (OWNER only)
 */
export function useRemoveMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, memberId }: { householdId: string; memberId: string }) => {
      await apiClient.delete(`/households/${householdId}/members/${memberId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['households', variables.householdId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['households', variables.householdId] });
    },
  });
}

/**
 * Leave a household (non-owners only)
 */
export function useLeaveHousehold() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (householdId: string) => {
      await apiClient.post(`/households/${householdId}/leave`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['savings-goals'] });
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
    },
  });
}

export interface HouseholdInvite {
  id: string;
  householdId: string;
  inviterId: string;
  inviteeId: string | null;
  email: string;
  role: 'OWNER' | 'EDITOR' | 'VIEWER';
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  acceptedAt: string | null;
  rejectedAt: string | null;
  household: {
    id: string;
    name: string;
    createdAt: string;
  };
  inviter: {
    id: string;
    email: string;
    displayName: string | null;
  };
  invitee?: {
    id: string;
    email: string;
    displayName: string | null;
  };
}

/**
 * Get pending invites for the current user
 */
export function usePendingInvites() {
  return useQuery({
    queryKey: ['households', 'invites', 'pending'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<HouseholdInvite[]>('/households/invites/pending');
        
        // API returns { success: true, data: HouseholdInvite[] }
        const invites = response.success && response.data ? response.data : [];
        
        return invites;
      } catch (error: any) {
        // Return empty array on error instead of throwing
        return [];
      }
    },
    refetchInterval: 30000, // Refetch every 30 seconds to check for new invites
  });
}

/**
 * Accept a household invite
 */
export function useAcceptInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      const response = await apiClient.post<HouseholdMember>(`/households/invites/${inviteId}/accept`);
      // API returns { success: true, data: HouseholdMember }
      const member = response.success && response.data ? response.data : null;
      return member!;
    },
    onSuccess: async (data) => {
      // Invalidate pending invites (remove accepted invite from list)
      queryClient.invalidateQueries({ queryKey: ['households', 'invites', 'pending'] });
      // Invalidate all household invites
      queryClient.invalidateQueries({ queryKey: ['households', 'invites'] });
      // Invalidate and refetch household members (add new member to list)
      if (data?.householdId) {
        queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'members'] });
        // Force refetch to ensure UI updates immediately
        await queryClient.refetchQueries({ queryKey: ['households', data.householdId, 'members'] });
        queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'invites'] });
        await queryClient.refetchQueries({ queryKey: ['households', data.householdId, 'invites'] });
      }
      // Invalidate households list (user might have access to new household)
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Reject a household invite
 */
export function useRejectInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      await apiClient.post(`/households/invites/${inviteId}/reject`);
    },
    onSuccess: () => {
      // Invalidate pending invites (remove rejected invite from list)
      queryClient.invalidateQueries({ queryKey: ['households', 'invites', 'pending'] });
      // Invalidate all household invites
      queryClient.invalidateQueries({ queryKey: ['households', 'invites'] });
    },
  });
}

/**
 * Get invites for a household (OWNER only)
 */
export function useHouseholdInvites(householdId: string) {
  return useQuery({
    queryKey: ['households', householdId, 'invites'],
    queryFn: async () => {
      try {
        const response = await apiClient.get<HouseholdInvite[]>(`/households/${householdId}/invites`);
        
        // API returns { success: true, data: HouseholdInvite[] }
        const invites = response.success && response.data ? response.data : [];
        
        return invites;
      } catch (error: any) {
        // If user is not OWNER, API will return 403 - that's OK, just return empty array
        if (error?.status === 403 || error?.status === 401) {
          return [];
        }
        throw error;
      }
    },
    enabled: !!householdId,
    retry: false, // Don't retry on 403 errors
  });
}

/**
 * Cancel an invite (OWNER only)
 */
export function useCancelInvite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (inviteId: string) => {
      await apiClient.delete(`/households/invites/${inviteId}`);
    },
    onSuccess: () => {
      // Invalidate all household invites (to remove cancelled invite from modal)
      queryClient.invalidateQueries({ queryKey: ['households', 'invites'] });
      // Invalidate pending invites (if invitee is logged in)
      queryClient.invalidateQueries({ queryKey: ['households', 'invites', 'pending'] });
      // Invalidate all household invites for any household (the cancelled invite might be from any household)
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update personal account access permission for current member
 * Allows others to use this member's personal accounts in shared household transactions
 */
export function useUpdatePersonalAccountAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, allowPersonalAccountAccess }: { householdId: string; allowPersonalAccountAccess: boolean }) => {
      const response = await apiClient.patch<HouseholdMember>(
        `/households/${householdId}/members/me/personal-account-access`,
        { allowPersonalAccountAccess }
      );
      return response.data!;
    },
    onSuccess: (data) => {
      // Invalidate members list to reflect the updated permission
      queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'members'] });
      // Invalidate available accounts to reflect the permission change
      queryClient.invalidateQueries({ queryKey: ['accounts', 'available'] });
    },
  });
}

/**
 * Update shared account IDs for current member
 * Allows a member to specify which of their personal accounts can be used in a shared household
 */
export function useUpdateSharedAccountIds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ householdId, sharedAccountIds }: { householdId: string; sharedAccountIds: string[] }) => {
      const response = await apiClient.patch<HouseholdMember>(
        `/households/${householdId}/members/me/shared-account-ids`,
        { sharedAccountIds }
      );
      return response.data!;
    },
    onSuccess: (data) => {
      // Invalidate members list to reflect the updated sharedAccountIds
      queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'members'] });
      // Invalidate available accounts to reflect the permission change
      queryClient.invalidateQueries({ queryKey: ['accounts', 'available'] });
    },
  });
}

// ============================================================================
// JOIN CODES (link recta.app/join/<code>: whoever opens it joins at once)
// ============================================================================

export interface HouseholdJoinCode {
  id: string;
  code: string;
  role: 'EDITOR' | 'VIEWER';
  expiresAt: string;
  createdAt: string;
}

export interface JoinCodePreview {
  householdId: string;
  householdName: string;
  inviterName: string;
  role: 'EDITOR' | 'VIEWER';
  expiresAt: string;
  alreadyMember: boolean;
}

/** The household's code still waiting to be used (OWNER only). */
export function useActiveJoinCode(householdId: string, enabled = true) {
  return useQuery({
    queryKey: ['households', householdId, 'join-code'],
    queryFn: async () => {
      const response = await apiClient.get<HouseholdJoinCode | null>(`/households/${householdId}/join-codes/active`);
      return response.data ?? null;
    },
    enabled: enabled && !!householdId,
  });
}

/** New code for the household; the previous one stops working. */
export function useCreateJoinCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, role }: { householdId: string; role: 'EDITOR' | 'VIEWER' }) => {
      const response = await apiClient.post<HouseholdJoinCode>(`/households/${householdId}/join-codes`, { role });
      return response.data!;
    },
    onSuccess: (data, { householdId }) => {
      queryClient.setQueryData(['households', householdId, 'join-code'], data);
    },
  });
}

export function useRevokeJoinCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ householdId, joinCodeId }: { householdId: string; joinCodeId: string }) => {
      await apiClient.delete(`/households/${householdId}/join-codes/${joinCodeId}`);
    },
    onSuccess: (_data, { householdId }) => {
      queryClient.setQueryData(['households', householdId, 'join-code'], null);
    },
  });
}

/** Household, inviter and role behind a code, for the confirm screen. */
export function useJoinCodePreview(code: string, enabled = true) {
  return useQuery({
    queryKey: ['households', 'join', code],
    queryFn: async () => {
      const response = await apiClient.get<JoinCodePreview>(`/households/join/${encodeURIComponent(code)}`);
      return response.data!;
    },
    enabled: enabled && !!code,
    retry: false,
  });
}

export function useRedeemJoinCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      const response = await apiClient.post<{ householdId: string; householdName: string; role: 'EDITOR' | 'VIEWER' }>(
        `/households/join/${encodeURIComponent(code)}`
      );
      return response.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['households'] });
      queryClient.invalidateQueries({ queryKey: ['households', data.householdId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}
