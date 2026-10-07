import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';
import type { CardOfxLine } from './useCardOfxPreview';

/** A preview line as the server wants it echoed back: without what the server recomputes. */
export type CardOfxConfirmLine = Omit<CardOfxLine, 'status' | 'possibleDuplicate'>;

export interface CardOfxConfirmRequest {
  accountId: string;
  /** Every line of the preview, in order: identical lines are told apart by their order. */
  lines: CardOfxConfirmLine[];
  selectedRefs: string[];
  createDespiteDuplicate: string[];
  links: Array<{ ref: string; transactionId: string }>;
  categoryMap: Array<{ merchant: string; type: 'INCOME' | 'EXPENSE'; categoryName: string }>;
}

export type CardOfxSkipCause = 'already-imported' | 'possible-duplicate' | 'link-refused';

export interface CardOfxConfirmResult {
  created: number;
  linked: number;
  skipped: Array<{ ref: string; cause: CardOfxSkipCause }>;
  ids: string[];
  /** Set when a line failed after others were saved: the lines before it are saved, the rest are not. */
  stoppedAt?: { ref: string; message: string };
}

/**
 * Confirm the import of a previewed invoice. The server saves line by line, so a big invoice takes longer than the
 * shared client's default: 100 ms per line on top of 30 s, at most 5 minutes (as the statement import does).
 */
export function useCardOfxConfirm() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: CardOfxConfirmRequest) => {
      const response = await axiosInstance.post<ApiResponse<CardOfxConfirmResult>>(
        '/transactions/import/card-ofx/confirm',
        request,
        { timeout: Math.min(5 * 60_000, 30_000 + request.lines.length * 100) },
      );
      return response.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
