import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';
import { CategoryType } from '../../lib/enums';

/** Category from GET /categories: system (id=enum, isSystem=true) or custom (id=uuid, isSystem=false) */
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  color?: string | null;
  icon?: string | null;
  isSystem: boolean;
  householdId?: string;
  usage?: { transactions: number; recurringTransactions: number; budgets: number } | null;
}

export interface CategoryStats {
  transactionCount: number;
  totalAmount: number;
  averageAmount: number;
  lastUsed?: string;
}

export interface ListCategoriesParams {
  householdId?: string;
  type?: CategoryType;
  /** true: every item carries usage counts (the category manager). */
  includeUsage?: boolean;
}

/**
 * List system + custom categories. householdId optional (backend defaults to personal).
 * When !householdId, query is disabled and custom list is empty.
 */
export function useCategories(params: ListCategoriesParams) {
  return useQuery({
    queryKey: ['categories', params],
    queryFn: async () => {
      const response = await apiClient.get<Category[]>('/categories', params as Record<string, unknown>);
      return (response as { data?: Category[] }).data ?? [];
    },
    enabled: true,
  });
}

/**
 * Get category by id (system enum or custom uuid).
 */
export function useCategory(categoryId: string) {
  return useQuery({
    queryKey: ['categories', categoryId],
    queryFn: async () => {
      const response = await apiClient.get<Category>(`/categories/${categoryId}`);
      return (response as { data?: Category }).data!;
    },
    enabled: !!categoryId,
  });
}

/**
 * Get category statistics
 */
export function useCategoryStats(categoryId: string) {
  return useQuery({
    queryKey: ['categories', categoryId, 'stats'],
    queryFn: async () => {
      const response = await apiClient.get<CategoryStats>(`/categories/${categoryId}/stats`);
      return response.data!;
    },
    enabled: !!categoryId,
  });
}

/**
 * Create custom category mutation. name is free-form (not enum).
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      householdId?: string;
      name: string;
      type: CategoryType;
      color?: string | null;
      icon?: string | null;
    }) => {
      const response = await apiClient.post<Category>('/categories', data);
      return (response as { data?: Category }).data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      // Invalidate auth/me to refresh household list
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
  });
}

/**
 * Update custom category (id = uuid). System categories cannot be updated.
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<Pick<Category, 'name' | 'color' | 'icon'>>) => {
      const response = await apiClient.patch<Category>(`/categories/${id}`, data);
      return (response as { data?: Category }).data!;
    },
    // Dashboard, budgets and reports resolve the name and colour on the server: refetch everything, like a merge does.
    onSettled: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/**
 * Delete category mutation
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (categoryId: string) => {
      await apiClient.delete(`/categories/${categoryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
}


export interface MergeCategoryResult {
  preview: boolean;
  sourceId: string;
  sourceName: string;
  type: CategoryType;
  target: { id: string; name: string; isSystem: boolean };
  counts: { transactions: number; recurringTransactions: number; budgets: number; budgetsCombined: number };
}

/** Counts only (POST /categories/:id/merge?preview=true): nothing is written. */
export async function previewMergeCategory(
  sourceId: string,
  body: { targetCategoryId: string } | { targetSystemName: string },
): Promise<MergeCategoryResult> {
  const response = await apiClient.post<MergeCategoryResult>(`/categories/${sourceId}/merge?preview=true`, body);
  return (response as { data?: MergeCategoryResult }).data!;
}

/**
 * Merge a custom category into another one of the same type (custom or system): every transaction, recurrence and
 * budget moves and the source is deleted. Whatever shows a category name changes, so everything is refetched.
 */
export function useMergeCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sourceId, body }: { sourceId: string; body: { targetCategoryId: string } | { targetSystemName: string } }) => {
      const response = await apiClient.post<MergeCategoryResult>(`/categories/${sourceId}/merge`, body);
      return (response as { data?: MergeCategoryResult }).data!;
    },
    onSettled: () => {
      void queryClient.invalidateQueries();
    },
  });
}
