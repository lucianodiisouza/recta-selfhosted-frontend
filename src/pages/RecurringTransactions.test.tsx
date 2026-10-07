// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RecurringTransactions from './RecurringTransactions';

const mocks = vi.hoisted(() => ({
  recurring: [] as Array<Record<string, unknown>>,
  role: 'OWNER' as string | undefined,
  detect: vi.fn(),
  updateRecurring: vi.fn(),
  success: vi.fn(),
}));

// Every value a mock returns is created once: a hook that answers with a new object on each render would make effects run
// forever.
const stable = await vi.hoisted(async () => {
  const en = (await import('../i18n/en-US.json')).default;
  const currencyInfo = { code: 'BRL', symbol: 'R$', locale: 'pt-BR', decimalPlaces: 2 };
  return {
    i18n: { t: en, locale: 'en-US' },
    currency: { baseCurrency: 'BRL', getCurrencyInfo: () => currencyInfo },
    toast: { success: (m: string) => mocks.success(m), error: vi.fn(), showToast: vi.fn() },
    commandMenu: { registerHandler: vi.fn(), unregisterHandler: vi.fn() },
    accounts: [{ id: 'acc-1', name: 'Bank', type: 'CHECKING', balance: 1000, isActive: true }],
    noop: vi.fn(async () => undefined),
  };
});

vi.mock('../context/TransactionsContext', () => ({
  useTransactions: () => ({
    recurringTransactions: mocks.recurring, accounts: stable.accounts, addRecurringTransaction: stable.noop,
    updateRecurringTransaction: mocks.updateRecurring, deleteRecurringTransaction: stable.noop, loading: false,
  }),
}));
vi.mock('../context/ToastContext', () => ({ useToastContext: () => stable.toast }));
vi.mock('../context/CommandMenuContext', () => ({ useCommandMenu: () => stable.commandMenu }));
vi.mock('../context/I18nContext', () => ({ useI18n: () => stable.i18n }));
vi.mock('../context/CurrencyContext', () => ({ useCurrency: () => stable.currency }));
vi.mock('../hooks/useDefaultHousehold', () => ({
  useDefaultHousehold: () => ({ householdId: 'h1', household: mocks.role ? { id: 'h1', role: mocks.role } : undefined }),
}));
vi.mock('../hooks/api/useDetectRecurring', () => ({
  useDetectRecurring: () => ({ mutateAsync: mocks.detect }),
  useApplyDetectedRecurring: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));
vi.mock('../utils/format', () => ({
  formatCurrency: (value: number, currency: string) => `${currency} ${value.toFixed(2)}`,
  formatDate: (d: Date) => d.toISOString().slice(0, 10),
  parseDateFromAPI: (d: string) => new Date(`${d.slice(0, 10)}T00:00:00.000Z`),
}));
// Child widgets that need layout or their own data are replaced by bare controls; the page logic under test stays real.
vi.mock('../components/CategoryCombobox', () => ({ default: () => null }));
vi.mock('../components/SelectCombobox', () => ({ default: () => null }));
vi.mock('../components/DatePicker', () => ({ DatePicker: () => null }));
vi.mock('../components/RecurringTransactionsActionsMenu', () => ({
  RecurringTransactionsActionsMenu: ({ recurring, onEdit }: { recurring: { id: string }; onEdit: (r: unknown) => void }) => (
    <button type="button" onClick={() => onEdit(recurring)}>edit-{recurring.id}</button>
  ),
}));

const t = (await import('../i18n/en-US.json')).default as Record<string, string>;

const rec = (id: string, extra: Record<string, unknown> = {}) => ({
  id, description: `Rec ${id}`, amount: 100, type: 'EXPENSE', category: 'UTILITIES', frequency: 'monthly', startDate: new Date(2026, 0, 5),
  nextDueDate: new Date(2026, 10, 5), accountId: 'acc-1', isActive: true, ...extra,
});

beforeEach(() => {
  localStorage.setItem('recurringTransactionsHelpSeen', 'true');
  mocks.role = 'OWNER';
  mocks.recurring = [rec('a', { followLastAmount: false })];
  mocks.detect.mockResolvedValue({ candidates: [], skipped: { alreadyRecurring: 0, installments: 0, sparse: 0, consumption: 0 } });
  mocks.updateRecurring.mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  localStorage.clear();
});

// The page header renders its buttons twice (desktop and mobile layouts).
const detectButtons = () => screen.queryAllByRole('button', { name: new RegExp(t.detectRecButton) });
const followBox = () => screen.queryByLabelText(t.recurringFollowLabel) as HTMLInputElement | null;

describe('RecurringTransactions page: "Detect recurring"', () => {
  it('is offered to an editor and opens the detection', async () => {
    render(<RecurringTransactions />);

    fireEvent.click(detectButtons()[0]!);

    await waitFor(() => expect(mocks.detect).toHaveBeenCalledWith({ householdId: 'h1' }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('is not offered to a viewer, nor while the household is unknown', () => {
    mocks.role = 'VIEWER';
    const { unmount } = render(<RecurringTransactions />);
    expect(detectButtons()).toHaveLength(0);
    unmount();

    mocks.role = undefined;
    render(<RecurringTransactions />);
    expect(detectButtons()).toHaveLength(0);
  });

  it('goes away, with its dialog, when the server has no detection route (framework 404 without an app code)', async () => {
    mocks.detect.mockRejectedValueOnce(Object.assign(new Error('Route POST:/recurring-transactions/detect not found'), { status: 404 }));
    render(<RecurringTransactions />);

    fireEvent.click(detectButtons()[0]!);

    await waitFor(() => expect(detectButtons()).toHaveLength(0));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('stays, with the error in the dialog, for any other failure', async () => {
    mocks.detect.mockRejectedValueOnce(Object.assign(new Error('Household not found'), { status: 404, code: 'NOT_FOUND' }));
    render(<RecurringTransactions />);

    fireEvent.click(detectButtons()[0]!);

    expect((await screen.findByRole('alert')).textContent).toBe('Household not found');
    expect(detectButtons().length).toBeGreaterThan(0);
  });
});

describe('RecurringTransactions page: "follow the last value"', () => {
  const openNew = () => fireEvent.click(screen.getAllByRole('button', { name: t.newRecurring })[0]!);

  it('offers the toggle in the form when the server reports the field', () => {
    render(<RecurringTransactions />);
    openNew();

    expect(followBox()).toBeTruthy();
  });

  it('hides the toggle and the badge when no recurrence carries the field (a server that predates it)', () => {
    mocks.recurring = [rec('a'), rec('b')];
    render(<RecurringTransactions />);
    openNew();

    expect(followBox()).toBeNull();
    expect(screen.queryByText(t.recurringFollowBadge)).toBeNull();
  });

  it('offers the toggle when there is nothing to learn from yet (no recurrences)', () => {
    mocks.recurring = [];
    render(<RecurringTransactions />);
    openNew();

    expect(followBox()).toBeTruthy();
  });

  it('shows the badge only for the recurrences that follow', () => {
    mocks.recurring = [rec('a', { followLastAmount: true }), rec('b', { followLastAmount: false })];
    render(<RecurringTransactions />);

    expect(screen.getAllByText(t.recurringFollowBadge)).toHaveLength(1);
  });

  it('reads an absent or false field as off and a true one as on when editing, and sends a boolean', async () => {
    mocks.recurring = [rec('on', { followLastAmount: true }), rec('off', { followLastAmount: false }), rec('absent')];
    render(<RecurringTransactions />);

    fireEvent.click(screen.getByRole('button', { name: 'edit-on' }));
    expect(followBox()!.checked).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: t.update }));
    await waitFor(() => expect(mocks.updateRecurring).toHaveBeenCalledTimes(1));
    expect(mocks.updateRecurring.mock.calls[0]![1]).toMatchObject({ followLastAmount: true });

    cleanup();
    vi.clearAllMocks();
    render(<RecurringTransactions />);
    fireEvent.click(screen.getByRole('button', { name: 'edit-absent' }));
    expect(followBox()!.checked).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: t.update }));
    await waitFor(() => expect(mocks.updateRecurring).toHaveBeenCalledTimes(1));
    expect(mocks.updateRecurring.mock.calls[0]![1]).toMatchObject({ followLastAmount: false });
  });
});
