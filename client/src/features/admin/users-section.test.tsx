// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { UsersSection } from './users-section'

const adminApiMock = vi.hoisted(() => ({
  addUserBalance: vi.fn(),
  listRoleOptions: vi.fn(),
  listUsers: vi.fn(),
  overwriteUserBalances: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserProfile: vi.fn(),
  updateUserRoles: vi.fn(),
}))

vi.mock('#/features/admin/api', () => ({
  adminApi: adminApiMock,
}))

vi.mock('#/components/feedback-banner', () => ({
  FeedbackBanner: ({ message }: { kind: 'error' | 'success'; message: string }) => (
    <div>{message}</div>
  ),
}))

vi.mock('#/features/admin/manual-refresh-button', () => ({
  ManualRefreshButton: ({ onClick }: { isRefreshing: boolean; onClick: () => void }) => (
    <button type="button" onClick={onClick}>
      Làm mới
    </button>
  ),
}))

afterEach(() => {
  cleanup()
  Object.values(adminApiMock).forEach((mock) => mock.mockReset())
})

function renderUsersSection({
  canManageUserAccounts = true,
}: {
  canManageUserAccounts?: boolean
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <UsersSection canManageUserAccounts={canManageUserAccounts} />
    </QueryClientProvider>,
  )
}

describe('UsersSection', () => {
  it('uses a search placeholder that mentions email, user ID, and phone number', async () => {
    adminApiMock.listUsers.mockResolvedValue([])
    adminApiMock.listRoleOptions.mockResolvedValue([])

    renderUsersSection()

    expect(
      await screen.findByPlaceholderText('Tìm theo email, user ID, số điện thoại...'),
    ).toBeTruthy()
  })

  it('does not render a USDT deposit total because the system does not support USDT deposits', async () => {
    adminApiMock.listUsers.mockResolvedValue([
      {
        balances: {
          usdt: { available: '10.000000', pending: '0.000000' },
          vnd: { available: '100000', pending: '0' },
        },
        createdAt: new Date().toISOString(),
        email: 'totals@gmail.com',
        id: 'user-2',
        phone: '0901234567',
        roles: ['user'],
        telegram: 'walletuser',
        totals: {
          totalDepositUsdt: '0.000000',
          totalDepositVnd: '100000',
          totalWithdrawUsdt: '0.000000',
          totalWithdrawVnd: '0',
        },
        twoFactorEnabled: false,
      },
    ])
    adminApiMock.listRoleOptions.mockResolvedValue([])

    renderUsersSection()

    expect(await screen.findByText('totals@gmail.com')).toBeTruthy()
    expect(screen.getByText('Nạp VND: 100.000 đ')).toBeTruthy()
    expect(screen.getByText('Rút VND (đã trừ ví): 0 đ')).toBeTruthy()
    expect(screen.getByText('Rút USDT (đã trừ ví): 0.00 USDT')).toBeTruthy()
    expect(screen.queryByText(/Nạp USDT:/)).toBeNull()
  })

  it('shows friendly role names without repeating the role code in the permissions modal', async () => {
    adminApiMock.listUsers.mockResolvedValue([
      {
        balances: {
          usdt: { available: '10.000000', pending: '0.000000' },
          vnd: { available: '100000', pending: '0' },
        },
        createdAt: new Date().toISOString(),
        email: 'test@gmail.com',
        id: 'user-1',
        phone: '0901234567',
        roles: ['user'],
        telegram: 'walletuser',
        totals: {
          totalDepositUsdt: '0.000000',
          totalDepositVnd: '100000',
          totalWithdrawUsdt: '0.000000',
          totalWithdrawVnd: '0',
        },
        twoFactorEnabled: false,
      },
    ])
    adminApiMock.listRoleOptions.mockResolvedValue([
      { code: 'admin', id: 'role-1', name: 'Admin' },
      { code: 'super_admin', id: 'role-2', name: 'Super Admin' },
      { code: 'user', id: 'role-3', name: 'User' },
    ])

    renderUsersSection()

    expect(await screen.findByText('test@gmail.com')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Quyền/i }))

    expect(await screen.findByText('Phân quyền: test@gmail.com')).toBeTruthy()
    expect(screen.getByLabelText('Admin')).toBeTruthy()
    expect(screen.getByLabelText('Super Admin')).toBeTruthy()
    expect(screen.getByLabelText('User')).toBeTruthy()
    expect(screen.queryByText('Admin admin')).toBeNull()
    expect(screen.queryByText('Super Admin super_admin')).toBeNull()
    expect(screen.queryByText('User user')).toBeNull()
  })

  it('shows account action buttons for super admins', async () => {
    adminApiMock.listUsers.mockResolvedValue([
      {
        balances: {
          usdt: { available: '10.000000', pending: '0.000000' },
          vnd: { available: '100000', pending: '0' },
        },
        createdAt: new Date().toISOString(),
        email: 'owner@gmail.com',
        id: 'user-3',
        phone: '0901234567',
        roles: ['user'],
        telegram: 'walletuser',
        totals: {
          totalDepositUsdt: '0.000000',
          totalDepositVnd: '100000',
          totalWithdrawUsdt: '0.000000',
          totalWithdrawVnd: '0',
        },
        twoFactorEnabled: false,
      },
    ])
    adminApiMock.listRoleOptions.mockResolvedValue([])

    renderUsersSection()

    expect(await screen.findByText('owner@gmail.com')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sửa/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /\+VND/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Reset 2FA/i })).toBeNull()
    expect(screen.getByText('Thao tác')).toBeTruthy()
  })

  it('hides all account actions for regular admins and skips role option loading', async () => {
    adminApiMock.listUsers.mockResolvedValue([
      {
        balances: {
          usdt: { available: '10.000000', pending: '0.000000' },
          vnd: { available: '100000', pending: '0' },
        },
        createdAt: new Date().toISOString(),
        email: 'readonly@gmail.com',
        id: 'user-4',
        phone: '0901234567',
        roles: ['user'],
        telegram: 'walletuser',
        totals: {
          totalDepositUsdt: '0.000000',
          totalDepositVnd: '100000',
          totalWithdrawUsdt: '0.000000',
          totalWithdrawVnd: '0',
        },
        twoFactorEnabled: false,
      },
    ])

    renderUsersSection({ canManageUserAccounts: false })

    expect(await screen.findByText('readonly@gmail.com')).toBeTruthy()
    expect(screen.queryByText('Thao tác')).toBeNull()
    expect(screen.queryByRole('button', { name: /Sửa/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Quyền/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Mật khẩu/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Số dư/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /\+VND/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /\+USDT/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /Reset 2FA/i })).toBeNull()
    expect(screen.getByText('Chỉ `super_admin` mới được quản lý tài khoản')).toBeTruthy()
    expect(adminApiMock.listRoleOptions).not.toHaveBeenCalled()
  })
})
