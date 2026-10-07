// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import enUS from '../i18n/en-US.json';
import { TransactionType } from '../lib/enums';
import type { Transaction } from '../types';
import TransactionModal from './TransactionModal';

const mocks = vi.hoisted(() => ({
  updateTransaction: vi.fn(),
  success: vi.fn(),
  showError: vi.fn(),
  recurring: [] as Array<Record<string, unknown>>,
  known: [] as Array<Record<string, unknown>>,
}));

// Every value a mock returns is created once: a hook that answers with a new object on each render would make the modal's
// effects run forever.
const stable = await vi.hoisted(async () => {
  const en = (await import('../i18n/en-US.json')).default;
  const account = { id: 'acc-1', name: 'Bank', type: 'CHECKING', balance: 1000, isActive: true };
  const accounts = [account];
  const accountsData = { accounts };
  const currencyInfo = { code: 'BRL', symbol: 'R$', locale: 'pt-BR', decimalPlaces: 2 };
  return {
    accounts,
    accountsData,
    currency: { baseCurrency: 'BRL', getCurrencyInfo: () => currencyInfo },
    household: { householdId: 'h1', household: { id: 'h1', role: 'OWNER' } },
    households: { data: [{ id: 'h1' }] },
    members: { data: [] },
    auth: { currentUser: { uid: 'u1' } },
    authUser: { data: { id: 'u1' } },
    available: { data: undefined },
    regular: { data: accountsData },
    categories: { data: [] },
    createCategory: { mutateAsync: vi.fn() },
    toast: { success: mocks.success, error: mocks.showError },
    i18n: { t: en, locale: 'en-US' },
    noop: vi.fn(),
  };
});

vi.mock('../context/TransactionsContext', () => ({
  useTransactions: () => ({
    addTransaction: stable.noop, updateTransaction: mocks.updateTransaction, createInstallments: stable.noop, accounts: stable.accounts,
    addRecurringTransaction: stable.noop, createTransfer: stable.noop, transactions: mocks.known, recurringTransactions: mocks.recurring,
  }),
}));
vi.mock('../context/ToastContext', () => ({ useToastContext: () => stable.toast }));
vi.mock('../context/I18nContext', () => ({ useI18n: () => stable.i18n }));
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => stable.currency }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => stable.auth }));
vi.mock('../hooks/api/useAuth', () => ({ useAuthUser: () => stable.authUser }));
vi.mock('../hooks/useDefaultHousehold', () => ({ useDefaultHousehold: () => stable.household }));
vi.mock('../hooks/api/useHouseholds', () => ({ useHouseholds: () => stable.households, useHouseholdMembers: () => stable.members }));
vi.mock('../hooks/api/useAccounts', () => ({ useAvailableAccounts: () => stable.available, useAccounts: () => stable.regular }));
vi.mock('../hooks/api/useCategories', () => ({ useCategories: () => stable.categories, useCreateCategory: () => stable.createCategory }));
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
  parseDateFromAPI: (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`),
}));

const t = enUS as Record<string, string>;

beforeAll(() => {
  class FakeResizeObserver { observe() {} unobserve() {} disconnect() {} }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = FakeResizeObserver;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
});

const occurrence: Transaction = {
  id: 'tx-1', userId: 'u1', description: 'Power', amount: 120, type: TransactionType.EXPENSE, category: 'UTILITIES', date: new Date(2026, 9, 10),
  accountId: 'acc-1', paid: false, recurringTransactionId: 'rec-1',
} as unknown as Transaction;

beforeEach(() => {
  mocks.updateTransaction.mockResolvedValue({});
  mocks.recurring = [{ id: 'rec-1', followLastAmount: true, lastOccurrenceDate: '2026-10-10' }];
  mocks.known = [];
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

const submit = () => fireEvent.click(screen.getByRole('button', { name: t.update }));
const sent = () => mocks.updateTransaction.mock.calls[0] as [string, Record<string, unknown>];

describe('TransactionModal: editing an occurrence of a recurrence that follows the last value', () => {
  it('says the value will be used in the following months when this is the most recent occurrence', () => {
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);

    expect(screen.getByText(t.recurringFollowHint)).toBeTruthy();
  });

  it('does not say it for an older occurrence', () => {
    mocks.recurring = [{ id: 'rec-1', followLastAmount: true, lastOccurrenceDate: '2026-11-10' }];
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);

    expect(screen.queryByText(t.recurringFollowHint)).toBeNull();
  });

  it('sends the update WITHOUT the amount when only another field changed (so the recurrence is not rewritten)', async () => {
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);
    fireEvent.change(document.querySelector('input[name="description"]') as HTMLElement, { target: { value: 'Power bill' } });

    submit();

    await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
    expect(sent()[0]).toBe('tx-1');
    expect(sent()[1]).toMatchObject({ description: 'Power bill' });
    expect('amount' in sent()[1]).toBe(false);
  });

  it('sends the amount when the user changed it', async () => {
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(t.currencyPlaceholder), { target: { value: '15000' } });

    submit();

    await waitFor(() => expect(mocks.updateTransaction).toHaveBeenCalledTimes(1));
    expect(sent()[1].amount).toBe(150);
  });

  it('confirms with the new recurrence amount when the server reports it, and says nothing otherwise', async () => {
    mocks.updateTransaction.mockResolvedValueOnce({ recurringUpdated: { id: 'rec-1', amount: 150 } });
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(t.currencyPlaceholder), { target: { value: '15000' } });
    submit();

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith('Recurrence updated to BRL 150.00'));
    expect(mocks.success).toHaveBeenCalledWith(t.transactionUpdated);

    cleanup();
    vi.clearAllMocks();
    mocks.updateTransaction.mockResolvedValue({});
    render(<TransactionModal transaction={occurrence} onClose={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(t.currencyPlaceholder), { target: { value: '15000' } });
    submit();

    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith(t.transactionUpdated));
    expect(mocks.success).toHaveBeenCalledTimes(1);
  });
});
