// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCardOfxConfirm } from './useCardOfxConfirm'
import type { CardOfxConfirmRequest } from './useCardOfxConfirm'

const post = vi.hoisted(() => vi.fn())
vi.mock('../../utils/api', () => ({ axiosInstance: { post } }))

const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>

const line = (i: number) => ({
  ref: `ofx:f${i}:00000000`,
  fitid: `f${i}`,
  date: '2026-11-10',
  amount: 1,
  type: 'EXPENSE' as const,
  kind: 'purchase' as const,
  memo: `Shop ${i}`,
  merchant: `Shop ${i}`,
  installment: null,
})
const request = (count: number): CardOfxConfirmRequest => ({
  accountId: 'card-1',
  lines: Array.from({ length: count }, (_, i) => line(i)),
  selectedRefs: [],
  createDespiteDuplicate: [],
  links: [],
  categoryMap: [],
})

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue({ data: { success: true, data: { created: 1, linked: 0, skipped: [], ids: ['a'] } } })
})

describe('useCardOfxConfirm', () => {
  it('posts the request as JSON and returns the data of the response', async () => {
    const { result } = renderHook(() => useCardOfxConfirm(), { wrapper })
    const body = request(2)

    result.current.mutate(body)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(post).toHaveBeenCalledWith('/transactions/import/card-ofx/confirm', body, { timeout: 30_200 })
    expect(result.current.data).toEqual({ created: 1, linked: 0, skipped: [], ids: ['a'] })
  })

  it('waits longer for a big invoice, up to five minutes', async () => {
    const { result } = renderHook(() => useCardOfxConfirm(), { wrapper })

    result.current.mutate(request(1000))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(post.mock.calls[0]![2]).toEqual({ timeout: 130_000 })
  })

  it('refreshes what the import changes, and nothing on failure', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCardOfxConfirm(), { wrapper })

    post.mockRejectedValueOnce(new Error('boom'))
    result.current.mutate(request(1))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(invalidate).not.toHaveBeenCalled()

    result.current.mutate(request(1))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(invalidate.mock.calls.map(([filters]) => (filters as { queryKey: string[] }).queryKey[0]).sort()).toEqual(['accounts', 'dashboard', 'transactions'])
  })
})
