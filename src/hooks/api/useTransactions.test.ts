import { QueryClient, hashKey } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { CreditCardInvoiceResponse } from './useTransactions';

// The hook module imports the auth context, which initialises Firebase when loaded.
vi.mock('../../config/firebase', () => ({ auth: {}, app: {} }));

// The hooks are called outside React, so the react-query hooks are replaced by ones that hand back the options
// they were given: that is what the wiring test below needs to read.
const rq = vi.hoisted(() => ({ client: undefined as unknown }));
vi.mock('@tanstack/react-query', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-query')>()),
  useQuery: (options: unknown) => options,
  useMutation: (options: unknown) => options,
  useQueryClient: () => rq.client,
}));

const { appendCreditCardInvoicePage, creditCardInvoiceKey, useCreditCardInvoice, useLoadMoreCreditCardInvoice } = await import('./useTransactions');

const firstPage = { accountId: 'card-1', month: '2026-10', householdId: 'hh-1', limit: 20 };

describe('creditCardInvoiceKey', () => {
  it('tells apart cards, months and households', () => {
    const hash = (params: Partial<typeof firstPage>) => hashKey(creditCardInvoiceKey({ ...firstPage, ...params }));

    expect(hash({ accountId: 'card-2' })).not.toBe(hash({}));
    expect(hash({ month: '2026-11' })).not.toBe(hash({}));
    expect(hash({ householdId: 'hh-2' })).not.toBe(hash({}));
  });

  it('gives "load more" the key of the first page, whatever cursor it paged with', () => {
    const loadMore = { ...firstPage, cursor: 'cursor-20' };

    expect(hashKey(creditCardInvoiceKey({ ...loadMore, cursor: undefined }))).toBe(hashKey(creditCardInvoiceKey(firstPage)));
  });

  it('keys the following pages apart from the first one', () => {
    expect(hashKey(creditCardInvoiceKey({ ...firstPage, cursor: 'cursor-20' }))).not.toBe(hashKey(creditCardInvoiceKey(firstPage)));
  });

  it('does not depend on optional params being absent or undefined', () => {
    const bare = { accountId: 'card-1', month: '2026-10' };

    expect(hashKey(creditCardInvoiceKey({ ...bare, householdId: undefined, limit: undefined }))).toBe(hashKey(creditCardInvoiceKey(bare)));
  });

});

describe('appendCreditCardInvoicePage', () => {
  const page = (...ids: string[]) => ({ invoiceTransactions: ids.map((id) => ({ id })) }) as unknown as CreditCardInvoiceResponse;
  const pagination = (hasMore: boolean) => ({ nextCursor: hasMore ? 'cursor-40' : null, hasMore });

  it('grows the entry the invoice query reads, not a new one', () => {
    const client = new QueryClient();
    client.setQueryData(creditCardInvoiceKey(firstPage), { data: page('a', 'b'), pagination: pagination(true) });

    appendCreditCardInvoicePage(client, { ...firstPage, cursor: 'cursor-20' }, { data: page('c'), pagination: pagination(false) });

    const shown = client.getQueryData<{ data: CreditCardInvoiceResponse; pagination: unknown }>(creditCardInvoiceKey(firstPage));
    expect(shown?.data.invoiceTransactions.map((t) => t.id)).toEqual(['a', 'b', 'c']);
    expect(shown?.pagination).toEqual(pagination(false));
    expect(client.getQueryCache().getAll()).toHaveLength(1);
  });
});

describe('the invoice query and "load more"', () => {
  it('write to the same cache entry', () => {
    const client = new QueryClient();
    rq.client = client;
    const invoice = useCreditCardInvoice(firstPage) as unknown as { queryKey: readonly unknown[] };
    const loadMore = useLoadMoreCreditCardInvoice() as unknown as {
      onSuccess: (data: unknown, variables: unknown) => void;
    };
    const page = (...ids: string[]) => ({ invoiceTransactions: ids.map((id) => ({ id })) });
    client.setQueryData(invoice.queryKey, { data: page('a'), pagination: { nextCursor: 'a', hasMore: true } });

    loadMore.onSuccess(
      { data: page('b'), pagination: { nextCursor: null, hasMore: false } },
      { ...firstPage, cursor: 'a' }
    );

    const shown = client.getQueryData<{ data: { invoiceTransactions: { id: string }[] } }>(invoice.queryKey);
    expect(shown?.data.invoiceTransactions.map((t) => t.id)).toEqual(['a', 'b']);
    expect(client.getQueryCache().getAll()).toHaveLength(1);
  });
});
