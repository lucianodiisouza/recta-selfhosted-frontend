// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfirmImport } from './useImportTransactions'

const post = vi.hoisted(() => vi.fn())
vi.mock('../../utils/api', () => ({ axiosInstance: { post } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const rows = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    date: '2026-11-05T00:00:00.000Z',
    description: `Row ${i}`,
    amount: 1,
    type: 'EXPENSE' as const,
  }))

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue({ data: { success: true, data: { imported: 1, skipped: 0, ids: ['a'] } } })
})

describe('useConfirmImport', () => {
  it('waits longer than the client default for a big file, in proportion to the rows', async () => {
    const { result } = renderHook(() => useConfirmImport(), { wrapper })

    result.current.mutate({ accountId: 'acc-1', rows: rows(1500) })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(post).toHaveBeenCalledWith(
      '/transactions/import/confirm',
      { accountId: 'acc-1', rows: expect.any(Array) },
      { timeout: 180_000 },
    )
  })

  it('returns the data of the response', async () => {
    const { result } = renderHook(() => useConfirmImport(), { wrapper })

    result.current.mutate({ accountId: 'acc-1', rows: rows(1) })
    await waitFor(() => expect(result.current.data).toEqual({ imported: 1, skipped: 0, ids: ['a'] }))
  })
})
