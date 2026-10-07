// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { isPeopleMissing, markPeopleMissing, resetPeopleMissing, usePeopleAvailable } from './peopleAvailability'

afterEach(() => resetPeopleMissing())

describe('people availability', () => {
  it('starts available: the menu entry is shown until the server says otherwise', () => {
    expect(isPeopleMissing()).toBe(false)
    expect(renderHook(() => usePeopleAvailable()).result.current).toBe(true)
  })

  it('tells every mounted consumer when the first 404 arrives, and stays missing', () => {
    const first = renderHook(() => usePeopleAvailable())
    const second = renderHook(() => usePeopleAvailable())
    act(() => markPeopleMissing())
    expect(first.result.current).toBe(false)
    expect(second.result.current).toBe(false)
    act(() => markPeopleMissing())
    expect(isPeopleMissing()).toBe(true)
  })

  it('a consumer mounted later already sees it missing', () => {
    markPeopleMissing()
    expect(renderHook(() => usePeopleAvailable()).result.current).toBe(false)
  })
})
