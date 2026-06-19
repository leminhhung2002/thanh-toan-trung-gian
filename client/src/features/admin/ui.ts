import type { AdminStatusFilter } from './api'

export type LegacyAdminTabId =
  | 'overview'
  | 'users'
  | 'transactions'
  | 'exchange'
  | 'banks'
  | 'withdrawals'
  | 'settings'

export const legacyAdminTabs: Array<{
  icon: string
  id: LegacyAdminTabId
  label: string
}> = [
  { id: 'overview', label: 'Tổng quan', icon: 'fas fa-chart-pie' },
  { id: 'users', label: 'Tài khoản', icon: 'fas fa-users' },
  { id: 'transactions', label: 'Nạp tiền', icon: 'fas fa-arrow-down' },
  { id: 'withdrawals', label: 'Rút tiền', icon: 'fas fa-arrow-up' },
  { id: 'exchange', label: 'Đổi tiền', icon: 'fas fa-right-left' },
  { id: 'banks', label: 'Ngân hàng', icon: 'fas fa-university' },
  { id: 'settings', label: 'Cài đặt', icon: 'fas fa-cog' },
]

export const adminStatusFilterOrder: AdminStatusFilter[] = [
  'all',
  'pending',
  'approved',
  'rejected',
]

export const defaultAdminStatusFilter: AdminStatusFilter = 'all'

export const adminStatusLabels: Record<AdminStatusFilter, string> = {
  approved: 'Đã duyệt',
  all: 'Tất cả',
  pending: 'Chờ duyệt',
  rejected: 'Đã từ chối',
}

export function getAdminUserTotalsUiCopy() {
  return {
    totalDepositVnd: 'Nạp VND',
    totalWithdrawUsdt: 'Rút USDT (đã trừ ví)',
    totalWithdrawVnd: 'Rút VND (đã trừ ví)',
  }
}

export function getVisibleAdminTabs(roles: string[]) {
  if (roles.includes('super_admin')) {
    return legacyAdminTabs
  }

  return legacyAdminTabs.filter(
    (tab) => tab.id !== 'banks' && tab.id !== 'settings',
  )
}
