// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { AdminOverviewMetrics } from './overview'
import { OverviewSection } from './admin-page'

const metrics: AdminOverviewMetrics = {
  banks: {
    activeCount: 3,
    pausedCount: 1,
    totalCount: 4,
    uniqueBankCount: 2,
  },
  filtered: {
    usdt: {
      depositAmountTotal: 25.5,
      depositCount: 2,
      netAmount: 15.25,
      transactionCount: 3,
      withdrawalAmountTotal: 10.25,
      withdrawalCount: 1,
    },
    vnd: {
      depositAmountTotal: 1500000,
      depositCount: 5,
      netAmount: 550000,
      transactionCount: 8,
      withdrawalAmountTotal: 950000,
      withdrawalCount: 3,
    },
  },
  profit: {
    feeNative: {
      usdt: 0.55,
      vnd: 31000,
    },
    feeVnd: 44750,
    markupVnd: 10846,
    totalVnd: 55596,
  },
  pending: {
    usdt: {
      depositAmountTotal: 0,
      depositCount: 0,
      netAmount: -3,
      transactionCount: 1,
      withdrawalAmountTotal: 3,
      withdrawalCount: 1,
    },
    vnd: {
      depositAmountTotal: 250000,
      depositCount: 1,
      netAmount: 50000,
      transactionCount: 2,
      withdrawalAmountTotal: 200000,
      withdrawalCount: 1,
    },
  },
  transactions: {
    exchangeCount: 2,
  },
  users: {
    adminCount: 2,
    standardUserCount: 10,
    superAdminCount: 1,
    totalCount: 13,
  },
}

describe('OverviewSection', () => {
  it('prioritizes financial metrics first and keeps operations in a compact block at the end', () => {
    render(
      <OverviewSection
        fromDate=""
        metrics={metrics}
        statusFilter="all"
        toDate=""
        toolbar={<div>filters</div>}
      />,
    )

    expect(screen.queryByRole('heading', { name: 'Tổng quan' })).toBeNull()
    expect(screen.getByText('filters')).toBeTruthy()
    expect(screen.getByText(/Bộ lọc hiện tại:/i)).toBeTruthy()
    expect(
      screen.getByText(/Lợi nhuận luôn tính theo khoảng hiện tại/i),
    ).toBeTruthy()
    expect(screen.getByText('Khối lượng giao dịch')).toBeTruthy()
    expect(screen.getByText('Lợi nhuận')).toBeTruthy()
    expect(screen.getByText('Dòng tiền VND')).toBeTruthy()
    expect(screen.getByText('Dòng tiền USDT')).toBeTruthy()
    expect(screen.getByText('Vận hành hệ thống')).toBeTruthy()
    expect(screen.getByText('Tổng lợi nhuận thực nhận')).toBeTruthy()
    expect(screen.getByText('Lợi nhuận từ markup exchange')).toBeTruthy()
    expect(
      screen.getByText('Lợi nhuận từ chênh lệch markup với realtime'),
    ).toBeTruthy()
    expect(screen.getAllByText(/không áp dụng bộ lọc trạng thái/i)).toHaveLength(2)
    expect(screen.queryByText('Snapshot giao dịch')).toBeNull()
    expect(screen.queryByText('Snapshot tài chính')).toBeNull()
    expect(screen.queryByText('Hệ thống và hạ tầng')).toBeNull()
    expect(screen.getByText('15.25 USDT')).toBeTruthy()
    expect(screen.queryByText('15.25 đ')).toBeNull()
    expect(screen.getByText('550.000 đ')).toBeTruthy()
    expect(screen.getAllByText('55.596 đ')).toHaveLength(2)
  })
})
