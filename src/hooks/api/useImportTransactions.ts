import { useMutation, useQueryClient } from '@tanstack/react-query';
import { axiosInstance } from '../../utils/api';
import { confirmTimeoutMs } from '../../utils/importStatement';
import type { ApiResponse } from '../../utils/api';

export type ImportTransactionType = 'INCOME' | 'EXPENSE';

export interface ImportPreviewRow {
  index: number;
  date: string;
  description: string;
  amount: number;
  type: ImportTransactionType;
  duplicate: boolean;
}

/** Why a line of the file was left out; the dialog maps each code to a translated message. */
export type ImportSkipReason =
  | 'invalid-date'
  | 'invalid-amount'
  | 'ambiguous-amount'
  | 'column-count'
  | 'repeated-id';

export interface ImportSkippedLine {
  line: number;
  reason: ImportSkipReason;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  total: number;
  duplicateCount: number;
  newCount: number;
  skipped?: ImportSkippedLine[];
  skippedCount?: number;
  /** `card-statement`: the file is a credit card invoice, which has its own flow. */
  warnings?: string[];
}

export interface ImportResult {
  imported: number;
  skipped: number;
  ids: string[];
  /** Set when a row failed after others were saved: the server stopped there and `error` says why. */
  stoppedAt?: number;
  error?: string;
}

export interface ImportPreviewParams {
  accountId: string;
  file: File;
}

export interface ConfirmImportRow {
  date: string;
  description: string;
  amount: number;
  type: ImportTransactionType;
}

export interface ConfirmImportParams {
  accountId: string;
  rows: ConfirmImportRow[];
}

/**
 * Upload a .csv/.ofx file and get the parsed preview.
 * Sends multipart FormData WITHOUT a manual Content-Type: the browser sets
 * `multipart/form-data; boundary=...` automatically. This must bypass
 * `apiClient.post` because the shared axios instance defaults to
 * `Content-Type: application/json`, under which axios would JSON-stringify
 * the FormData and destroy the file upload. The response interceptor
 * (formatted {message, status} Error) still applies since it lives on
 * the shared axios instance.
 */
export function useImportPreview() {
  return useMutation({
    mutationFn: async ({ accountId, file }: ImportPreviewParams) => {
      const formData = new FormData();
      formData.append('accountId', accountId);
      formData.append('file', file);

      const response = await axiosInstance.post<ApiResponse<ImportPreview>>(
        '/transactions/import/preview',
        formData,
        {
          // Remove the instance JSON default so the browser sets multipart + boundary.
          headers: { 'Content-Type': undefined as unknown as string },
        },
      );
      return response.data.data!;
    },
  });
}

/**
 * Confirm the import of previously previewed rows.
 */
export function useConfirmImport() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ accountId, rows }: ConfirmImportParams) => {
      // Longer than the client default: the server saves the rows one by one (see confirmTimeoutMs).
      const response = await axiosInstance.post<ApiResponse<ImportResult>>(
        '/transactions/import/confirm',
        { accountId, rows },
        { timeout: confirmTimeoutMs(rows.length) },
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
