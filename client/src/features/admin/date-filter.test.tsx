// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  AdminDateFilter,
  getAdminDateRangeError,
  getNextEffectiveAdminDateRange,
  isAdminDateRangeValid,
  shouldShowAdminDateFilter,
} from './date-filter'

describe('admin date filter helpers', () => {
  afterEach(() => {
    cleanup()
  })

  it('only enables the date filter for overview, deposits, withdrawals, and exchange', () => {
    expect(shouldShowAdminDateFilter('overview')).toBe(true)
    expect(shouldShowAdminDateFilter('transactions')).toBe(true)
    expect(shouldShowAdminDateFilter('withdrawals')).toBe(true)
    expect(shouldShowAdminDateFilter('exchange')).toBe(true)
    expect(shouldShowAdminDateFilter('users')).toBe(false)
    expect(shouldShowAdminDateFilter('banks')).toBe(false)
    expect(shouldShowAdminDateFilter('settings')).toBe(false)
  })

  it('renders toolbar-style from/to date inputs', () => {
    const onFromDateChange = vi.fn()
    const onToDateChange = vi.fn()

    render(
      <AdminDateFilter
        fromDate="2026-04-06"
        fromId="review-date-filter-from"
        onFromDateChange={onFromDateChange}
        onToDateChange={onToDateChange}
        toDate="2026-04-07"
        toId="review-date-filter-to"
      />,
    )

    const fromInput = screen.getByLabelText('Từ ngày') as HTMLInputElement
    const toInput = screen.getByLabelText('Đến ngày') as HTMLInputElement

    expect(fromInput.value).toBe('2026-04-06')
    expect(toInput.value).toBe('2026-04-07')

    fireEvent.change(fromInput, { target: { value: '2026-04-05' } })
    fireEvent.change(toInput, { target: { value: '2026-04-08' } })

    expect(onFromDateChange).toHaveBeenCalledWith('2026-04-05')
    expect(onToDateChange).toHaveBeenCalledWith('2026-04-08')
  })

  it('reports invalid or incomplete date ranges and keeps the last valid effective range', () => {
    expect(isAdminDateRangeValid({ fromDate: '2026-04-06', toDate: '2026-04-07' })).toBe(
      true,
    )
    expect(isAdminDateRangeValid({ fromDate: '2026-04-08', toDate: '2026-04-07' })).toBe(
      false,
    )
    expect(
      getAdminDateRangeError({ fromDate: '2026-04-06', toDate: '' }),
    ).toBe('Vui lòng chọn đủ từ ngày và đến ngày.')
    expect(
      getAdminDateRangeError({ fromDate: '2026-04-08', toDate: '2026-04-07' }),
    ).toBe('Khoảng ngày không hợp lệ.')
    expect(
      getNextEffectiveAdminDateRange(
        { fromDate: '2026-04-06', toDate: '2026-04-06' },
        { fromDate: '2026-04-08', toDate: '2026-04-07' },
      ),
    ).toEqual({
      fromDate: '2026-04-06',
      toDate: '2026-04-06',
    })
  })
})
