// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    createFileRoute: () => () => ({ component: null }),
    useNavigate: () => navigateMock,
  }
})

const accountApiMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
  updateProfile: vi.fn(),
}))

const authApiMock = vi.hoisted(() => ({
  logout: vi.fn(),
}))

vi.mock('#/features/account/api', () => ({
  accountApi: accountApiMock,
}))

vi.mock('#/features/auth/api', () => ({
  authApi: authApiMock,
}))

vi.mock('#/features/auth/route-gates', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('#/components/bottom-nav', () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}))

vi.mock('#/components/screen-loader', () => ({
  ScreenLoader: ({ message }: { message?: string }) => <div>{message ?? 'Đang tải...'}</div>,
}))

vi.mock('#/features/history/notification-overlay', () => ({
  NotificationHistoryOverlay: () => null,
}))

vi.mock('#/lib/auth/auth-context', () => ({
  browserSessionStore: {
    clear: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
  useAuthSession: () => ({
    clearSession: vi.fn(),
    session: {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        email: 'user@example.com',
        id: 'user-1',
        roles: ['user'],
      },
    },
  }),
}))

const accountModule = await import('./account')

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
  Object.values(accountApiMock).forEach((mock) => mock.mockReset())
  Object.values(authApiMock).forEach((mock) => mock.mockReset())
})

function renderAccountScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const AccountScreen = (accountModule as { AccountScreen?: ComponentType }).AccountScreen

  if (!AccountScreen) {
    throw new Error('AccountScreen export is missing')
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AccountScreen />
    </QueryClientProvider>,
  )
}

describe('AccountScreen', () => {
  it('shows masked account info immediately and removes reveal buttons', async () => {
    accountApiMock.getProfile.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: '0901234567',
      roles: ['user'],
      telegram: 'walletuser',
      twoFactorEnabled: false,
    })

    renderAccountScreen()

    expect(await screen.findByText('Thông tin tài khoản')).toBeTruthy()
    expect(screen.getByText('us************om')).toBeTruthy()
    expect(screen.getByText('09******67')).toBeTruthy()
    expect(screen.getByText('wa******er')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Hiện' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Ẩn' })).toBeNull()
    expect(screen.queryByText(/2FA/i)).toBeNull()
  })

  it('keeps the telegram change flow working with password confirmation', async () => {
    accountApiMock.getProfile.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: '0901234567',
      roles: ['user'],
      telegram: 'walletuser',
      twoFactorEnabled: false,
    })
    accountApiMock.updateProfile.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: '0901234567',
      roles: ['user'],
      telegram: 'newwallet',
      twoFactorEnabled: false,
    })

    renderAccountScreen()

    await screen.findByText('Thông tin tài khoản')
    fireEvent.click(screen.getAllByRole('button', { name: 'Thay đổi' })[1])
    fireEvent.change(screen.getByPlaceholderText('Nhập username Telegram'), {
      target: { value: 'https://t.me/newwallet' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'Secret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    await waitFor(() => {
      expect(accountApiMock.updateProfile).toHaveBeenCalledWith({
        currentPassword: 'Secret123!',
        phone: '0901234567',
        telegram: 'https://t.me/newwallet',
      })
    })
  })

  it('opens sensitive edit inputs empty while keeping placeholders visible', async () => {
    accountApiMock.getProfile.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: '0901234567',
      roles: ['user'],
      telegram: 'walletuser',
      twoFactorEnabled: false,
    })

    renderAccountScreen()

    await screen.findByText('Thông tin tài khoản')

    fireEvent.click(screen.getAllByRole('button', { name: 'Thay đổi' })[0])

    expect(
      (screen.getByPlaceholderText('Nhập số điện thoại') as HTMLInputElement).value,
    ).toBe('')

    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Thay đổi' })[1])

    expect(
      (screen.getByPlaceholderText('Nhập username Telegram') as HTMLInputElement).value,
    ).toBe('')
    expect(screen.getByPlaceholderText('Nhập mật khẩu hiện tại')).toBeTruthy()
  })

  it('shows an inline error when saving a sensitive change without password confirmation', async () => {
    accountApiMock.getProfile.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: '0901234567',
      roles: ['user'],
      telegram: 'walletuser',
      twoFactorEnabled: false,
    })

    renderAccountScreen()

    await screen.findByText('Thông tin tài khoản')
    fireEvent.click(screen.getAllByRole('button', { name: 'Thay đổi' })[0])
    fireEvent.change(screen.getByPlaceholderText('Nhập số điện thoại'), {
      target: { value: '0909999999' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))

    expect(
      await screen.findByText('Vui lòng nhập mật khẩu hiện tại để xác nhận thay đổi.'),
    ).toBeTruthy()
    expect(accountApiMock.updateProfile).not.toHaveBeenCalled()
  })
})
