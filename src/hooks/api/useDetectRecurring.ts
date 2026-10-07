import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../utils/api';

// Detect recurring expenses in the history and create the recurrences. Types mirror the HTTP contract of
// POST /recurring-transactions/detect and /detect/apply; amounts are reais on the wire (the pure logic in
// utils/recurringDetect.ts works in integer cents). Nothing is persisted by `detect`.

export type RecurringCandidateKind = 'stable' | 'bill';

export interface RecurringCandidateExample {
  transactionId: string;
  /** YYYY-MM-DD (or an ISO timestamp: only the date part is shown) */
  date: string;
  amount: number;
  description: string;
}

export interface RecurringCandidate {
  /** Deterministic: account + normalized description. The apply refers to a candidate by this id. */
  id: string;
  accountId: string;
  accountName: string;
  /** The most frequent spelling. */
  description: string;
  categoryName: string;
  /** Suggested amount (the most recent). */
  amount: number;
  medianAmount: number;
  minAmount: number;
  maxAmount: number;
  /** 1-31 */
  dayOfMonth: number;
  monthsSeen: number;
  windowMonths: number;
  /** YYYY-MM */
  lastMonth: string;
  kind: RecurringCandidateKind;
  /** 0..1 */
  confidence: number;
  defaultSelected: boolean;
  /** Whether the recurrence created from this candidate follows the last real amount (default true; absent counts as true). */
  followLastAmount: boolean;
  /** Up to 6, most recent first. */
  examples: RecurringCandidateExample[];
}

export interface RecurringDetectSkipped {
  alreadyRecurring: number;
  installments: number;
  sparse: number;
  consumption: number;
}

export interface RecurringDetectInput {
  householdId: string;
  /** Default 3. */
  minMonths?: number;
  /** Window in months, default 12. */
  months?: number;
}

export interface RecurringDetectResponse {
  candidates: RecurringCandidate[];
  skipped: RecurringDetectSkipped;
}

/** The adjustments the user may make to one chosen candidate; a field that is not adjusted is left out. */
export interface RecurringApplyItem {
  id: string;
  amount?: number;
  dayOfMonth?: number;
  description?: string;
  /** Sent only when the user chose differently from the candidate's own value. */
  followLastAmount?: boolean;
}

export interface RecurringApplyInput {
  householdId: string;
  minMonths?: number;
  months?: number;
  items: RecurringApplyItem[];
}

/** Something apply did not do as asked; the client translates the code. */
export interface RecurringApplyWarning {
  code: 'duplicate-in-call' | 'already-active' | 'short-month-day';
  description: string;
  dayOfMonth?: number;
}

export interface RecurringApplyResult {
  created: number;
  skipped: number;
  linkedTransactions: number;
  warnings: RecurringApplyWarning[];
}

/** Reads the history and proposes the candidates. A mutation (POST), so the dialog drives it explicitly and latest-wins. */
export function useDetectRecurring() {
  return useMutation({
    mutationFn: async (input: RecurringDetectInput): Promise<RecurringDetectResponse> => {
      const response = await apiClient.post<RecurringDetectResponse>('/recurring-transactions/detect', input);
      return response.data!;
    },
  });
}

/**
 * Creates the recurrences of the chosen candidates (201, one request). Invalidates on success AND on error: a failed
 * request may already have created part of them, and the lists must not keep stale data.
 */
export function useApplyDetectedRecurring() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: RecurringApplyInput): Promise<RecurringApplyResult> => {
      const response = await apiClient.post<RecurringApplyResult>('/recurring-transactions/detect/apply', input);
      return response.data!;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}
