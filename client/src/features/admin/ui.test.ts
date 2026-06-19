import { describe, expect, it } from 'vitest'

import {
  adminStatusFilterOrder,
  defaultAdminStatusFilter,
  getAdminUserTotalsUiCopy,
  getVisibleAdminTabs,
  legacyAdminTabs,
} from './ui'

describe('legacyAdminTabs', () => {
  it('matches the old admin shell ordering and labels', () => {
    expect(
      legacyAdminTabs.map((tab) => ({
        icon: tab.icon,
        id: tab.id,
        label: tab.label,
      })),
    ).toEqual([
      { id: 'overview', label: 'Tổng quan', icon: 'fas fa-chart-pie' },
      { id: 'users', label: 'Tài khoản', icon: 'fas fa-users' },
      { id: 'transactions', label: 'Nạp tiền', icon: 'fas fa-arrow-down' },
      { id: 'withdrawals', label: 'Rút tiền', icon: 'fas fa-arrow-up' },
      { id: 'exchange', label: 'Đổi tiền', icon: 'fas fa-right-left' },
      { id: 'banks', label: 'Ngân hàng', icon: 'fas fa-university' },
      { id: 'settings', label: 'Cài đặt', icon: 'fas fa-cog' },
    ])
  })
})

describe('getAdminUserTotalsUiCopy', () => {
  it('shows only supported deposit and withdrawal labels in the admin user totals column', () => {
    expect(getAdminUserTotalsUiCopy()).toEqual({
      totalDepositVnd: 'Nạp VND',
      totalWithdrawUsdt: 'Rút USDT (đã trừ ví)',
      totalWithdrawVnd: 'Rút VND (đã trừ ví)',
    })
  })
})

describe('getVisibleAdminTabs', () => {
  it('hides banks and settings from regular admins while keeping them for super admins', () => {
    expect(getVisibleAdminTabs(['user', 'admin']).map((tab) => tab.id)).toEqual([
      'overview',
      'users',
      'transactions',
      'withdrawals',
      'exchange',
    ])

    expect(getVisibleAdminTabs(['user', 'admin', 'super_admin']).map((tab) => tab.id)).toEqual([
      'overview',
      'users',
      'transactions',
      'withdrawals',
      'exchange',
      'banks',
      'settings',
    ])
  })
})

describe('admin status filter defaults', () => {
  it('keeps "Tất cả" as the first option and default status filter', () => {
    expect(adminStatusFilterOrder).toEqual([
      'all',
      'pending',
      'approved',
      'rejected',
    ])
    expect(defaultAdminStatusFilter).toBe('all')
  })
})
