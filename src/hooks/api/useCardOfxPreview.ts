import { useMutation } from '@tanstack/react-query';
import { axiosInstance } from '../../utils/api';
import type { ApiResponse } from '../../utils/api';

// The contract of POST /transactions/import/card-ofx/preview. Anything the server wants worded is a code here; the
// dialog maps each one to a translated message.

export type CardOfxKind = 'purchase' | 'refund' | 'discount' | 'payment';

/**
 * new: no transaction holds the line yet; reconciled: an earlier import (or a link) already holds it; payment: a
 * "payment received" line.
 */
export type CardOfxStatus = 'new' | 'reconciled' | 'payment';

/** A transaction typed by hand that looks like the same purchase (same direction, amount and a date within 3 days). */
export interface CardOfxPossibleDuplicate {
  transactionId: string;
  description: string | null;
  /** YYYY-MM-DD */
  date: string;
}

export interface CardOfxLine {
  ref: string;
  fitid: string;
  /** YYYY-MM-DD */
  date: string;
  /** Always positive; the direction is in `type`. */
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  kind: CardOfxKind;
  memo: string;
  merchant: string;
  installment: { number: number; total: number } | null;
  status: CardOfxStatus;
  /** Only on new lines. */
  possibleDuplicate: CardOfxPossibleDuplicate | null;
}

export type CardOfxSkipReason =
  | 'invalid-amount'
  | 'zero-amount'
  | 'amount-too-large'
  | 'invalid-date'
  | 'missing-id'
  | 'id-too-long';

export type CardOfxWarning =
  | 'multiple-statements'
  | 'period-end-missing'
  | 'card-without-due-day'
  | 'card-without-closing-day'
  | 'balance-mismatch'
  | 'possible-duplicates';

export type CardOfxPaymentState = 'matches' | 'differs' | 'missing' | 'undetermined';

export interface CardOfxPayment {
  /** The invoice the payment lines pay, YYYY-MM. */
  invoiceMonthKey: string;
  statementTotal: number;
  recorded: Array<{ transactionId: string; amount: number; date: string }>;
  recordedTotal: number;
  state: CardOfxPaymentState;
}

export interface CardOfxPreview {
  accountId: string;
  month: { year: number; month: number };
  monthKey: string;
  monthSource: 'statement' | 'override';
  period: { start: string; end: string };
  /** Purchases minus refunds and discounts, payments left out. */
  ofxTotal: number;
  /** The debt the file states (positive), null when it has none. */
  ledgerBalance: number | null;
  lines: CardOfxLine[];
  /** What the household last gave each merchant of the new lines. */
  categorySuggestions: Array<{ merchant: string; type: 'INCOME' | 'EXPENSE'; categoryName: string }>;
  /** The first 100 only; `totals.skipped` has the count. */
  skipped: Array<{ position: number; reason: CardOfxSkipReason }>;
  payment: CardOfxPayment | null;
  totals: { lines: number; new: number; reconciled: number; payments: number; skipped: number; possibleDuplicates: number };
  warnings: CardOfxWarning[];
}

export interface CardOfxPreviewParams {
  accountId: string;
  file: File;
  /** Replaces the invoice month the server derives from the file. */
  monthOverride?: { year: number; month: number };
}

/**
 * Upload a card invoice (.ofx) and get what it holds. Sends multipart FormData WITHOUT a manual Content-Type (the
 * browser adds the boundary), so it goes through the shared axios instance with the JSON default removed, as the
 * statement import does. Nothing is saved on the server.
 */
export function useCardOfxPreview() {
  return useMutation({
    mutationFn: async ({ accountId, file, monthOverride }: CardOfxPreviewParams) => {
      const formData = new FormData();
      formData.append('accountId', accountId);
      if (monthOverride) formData.append('options', JSON.stringify({ monthOverride }));
      formData.append('file', file);

      const response = await axiosInstance.post<ApiResponse<CardOfxPreview>>(
        '/transactions/import/card-ofx/preview',
        formData,
        { headers: { 'Content-Type': undefined as unknown as string } },
      );
      return response.data.data!;
    },
  });
}
