// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useUpdateTransaction } from './useTransactions';

const api = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock('../../utils/api', () => ({ apiClient: { patch: api.patch } }));
vi.mock('../../context/AuthContext', () => ({ useAuth: () => ({ currentUser: null }) }));
vi.mock('../../utils/format', () => ({ formatDateForAPI: (d: Date) => d.toISOString().slice(0, 10) }));

async function update(response: Record<string, unknown>) {
  api.patch.mockResolvedValueOnce({ data: response });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const invalidate = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useUpdateTransaction(), { wrapper });
  await act(async () => { await result.current.mutateAsync({ id: 'tx-1', description: 'x' }); });
  return invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
}

describe('useUpdateTransaction', () => {
  it('refreshes the recurrences too when the server says it changed the recurrence of the transaction', async () => {
    const keys = await update({ id: 'tx-1', recurringUpdated: { id: 'rec-1', amount: 150 } });

    expect(keys).toContainEqual(['recurring-transactions']);
    expect(keys).toContainEqual(['transactions']);
  });

  it('leaves the recurrences alone otherwise', async () => {
    const keys = await update({ id: 'tx-1' });

    expect(keys).not.toContainEqual(['recurring-transactions']);
    expect(keys).toContainEqual(['transactions']);
  });

  it('PATCHes the transaction with the fields given and nothing else', async () => {
    await update({ id: 'tx-1' });

    expect(api.patch).toHaveBeenCalledWith('/transactions/tx-1', { description: 'x' });
  });
});
