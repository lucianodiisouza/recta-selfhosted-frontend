import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, axiosInstance } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import { isPeopleRouteMissing } from '../../utils/people';
import { markPeopleMissing } from '../../utils/peopleAvailability';

// ============================================================================
// Types mirrored from the HTTP contract of the people routes (backend: modules/people). The frontend cannot import
// the backend types, so the names follow the contract and both sides can be diffed. Pure logic: utils/people.ts.
// Amounts are reais with 2 decimals (the UI compares them in integer cents).
// ============================================================================

export type ShareDirection = 'THEY_OWE_ME' | 'I_OWE_THEM';
export type SettlementDirection = 'RECEIVED' | 'PAID';

export interface Person {
  id: string;
  householdId: string;
  name: string;
  aliases: string[];
  userId: string | null;
  isActive: boolean;
}

export interface PersonBalance {
  person: Person;
  owedToMe: number;
  iOwe: number;
  received: number;
  paid: number;
  /** owedToMe - iOwe - received + paid; > 0 means the person owes me. */
  balance: number;
  openShares: number;
}

export interface LedgerEntry {
  kind: 'share' | 'settlement';
  id: string;
  /** YYYY-MM-DD */
  date: string;
  description: string;
  direction: ShareDirection | SettlementDirection;
  amount: number;
  /** > 0 increases what the person owes me. */
  signed: number;
  balanceAfter: number;
  transactionId: string | null;
  transactionAmount: number | null;
  note: string | null;
}

export interface LedgerPage {
  data: LedgerEntry[];
  pagination: { nextCursor: string | null; hasMore: boolean; total?: number };
}

// ============================================================================
// Query keys
// ============================================================================

/** All the people data lives under ['people', ...]. */
export const peopleKeys = {
  all: ['people'] as const,
  list: (householdId: string | undefined, includeInactive: boolean) => ['people', 'list', householdId, includeInactive] as const,
  balances: (householdId: string | undefined) => ['people', 'balances', householdId] as const,
  ledger: (householdId: string | undefined, personId: string | undefined) => ['people', 'ledger', householdId, personId] as const,
};

/** Runs a people request and remembers that the server has no people routes when it says so. */
async function probed<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (isPeopleRouteMissing(error)) markPeopleMissing();
    throw error;
  }
}

// ============================================================================
// People
// ============================================================================

export function usePeople(householdId: string | undefined, includeInactive = false) {
  return useQuery({
    queryKey: peopleKeys.list(householdId, includeInactive),
    queryFn: () =>
      probed(async () => {
        const response = await apiClient.get<Person[]>('/people', { householdId, includeInactive: includeInactive ? true : undefined });
        return response.data ?? [];
      }),
    enabled: !!householdId,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}

export function usePeopleBalances(householdId: string | undefined) {
  return useQuery({
    queryKey: peopleKeys.balances(householdId),
    queryFn: () =>
      probed(async () => {
        const response = await apiClient.get<PersonBalance[]>('/people/balances', { householdId });
        return response.data ?? [];
      }),
    enabled: !!householdId,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}

export interface CreatePersonInput {
  householdId: string;
  name: string;
  aliases?: string[];
}

export function useCreatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePersonInput): Promise<Person> => {
      const response = await apiClient.post<Person>('/people', input);
      return response.data!;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
    },
  });
}

export interface UpdatePersonInput {
  id: string;
  name?: string;
  aliases?: string[];
  isActive?: boolean;
}

export function useUpdatePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: UpdatePersonInput): Promise<Person> => {
      const response = await apiClient.patch<Person>(`/people/${id}`, patch);
      return response.data!;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
    },
  });
}

/** 204: the person had no data and is gone. 200: the person had data and was only deactivated (the person comes back). */
export type DeletePersonResult = { deleted: true; person: null } | { deleted: false; person: Person | null };

export function useDeletePerson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<DeletePersonResult> => {
      // The raw instance: apiClient.delete hides the status, and the status is the answer here.
      const response = await axiosInstance.delete<ApiResponse<Person> | undefined>(`/people/${id}`);
      if (response.status === 204) return { deleted: true, person: null };
      const body = response.data;
      return { deleted: false, person: body && typeof body === 'object' && 'data' in body ? (body.data ?? null) : null };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: peopleKeys.all });
    },
  });
}

// ============================================================================
// Ledger (cursor)
// ============================================================================

/** The pagination of the list endpoints sits beside `data` at the top level of the response. */
type PagedResponse = ApiResponse<LedgerEntry[]> & { pagination?: LedgerPage['pagination'] };

export const LEDGER_PAGE_SIZE = 25;

export function usePersonLedger(householdId: string | undefined, personId: string | undefined) {
  return useInfiniteQuery({
    queryKey: peopleKeys.ledger(householdId, personId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      probed(async (): Promise<LedgerPage> => {
        const response = (await apiClient.get<LedgerEntry[]>(`/people/${personId}/ledger`, {
          householdId,
          limit: LEDGER_PAGE_SIZE,
          cursor: pageParam,
        })) as PagedResponse;
        return { data: response.data ?? [], pagination: response.pagination ?? { nextCursor: null, hasMore: false } };
      }),
    getNextPageParam: (last) => (last.pagination.hasMore && last.pagination.nextCursor ? last.pagination.nextCursor : undefined),
    enabled: !!householdId && !!personId,
    refetchOnWindowFocus: false,
    staleTime: 0,
  });
}
