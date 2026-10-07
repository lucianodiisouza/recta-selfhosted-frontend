// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCardOfxPreview } from './useCardOfxPreview'

const post = vi.hoisted(() => vi.fn())
vi.mock('../../utils/api', () => ({ axiosInstance: { post } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}>
    {children}
  </QueryClientProvider>
)

const file = new File(['x'], 'invoice.ofx')

beforeEach(() => {
  post.mockReset()
  post.mockResolvedValue({ data: { success: true, data: { monthKey: '2026-12' } } })
})

async function run(params: Parameters<ReturnType<typeof useCardOfxPreview>['mutate']>[0]) {
  const { result } = renderHook(() => useCardOfxPreview(), { wrapper })
  result.current.mutate(params)
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const [url, body, config] = post.mock.calls[0]
  return { result, url: url as string, body: body as FormData, config }
}

describe('useCardOfxPreview', () => {
  it('posts the card and the file as multipart, letting the browser set the boundary', async () => {
    const { result, url, body, config } = await run({ accountId: 'card-1', file })

    expect(url).toBe('/transactions/import/card-ofx/preview')
    expect(body.get('accountId')).toBe('card-1')
    expect(body.get('file')).toBeInstanceOf(File)
    expect((body.get('file') as File).name).toBe('invoice.ofx')
    expect(body.has('options')).toBe(false)
    expect(config.headers['Content-Type']).toBeUndefined()
    expect(result.current.data).toEqual({ monthKey: '2026-12' })
  })

  it('sends the month the user chose as the options JSON', async () => {
    const { body } = await run({ accountId: 'card-1', file, monthOverride: { year: 2027, month: 2 } })

    expect(JSON.parse(body.get('options') as string)).toEqual({ monthOverride: { year: 2027, month: 2 } })
  })
})
