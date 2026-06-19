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
    Link: ({
      children,
      className,
      to,
    }: {
      children: React.ReactNode
      className?: string
      to?: string
    }) => (
      <a className={className} href={to}>
        {children}
      </a>
    ),
    createFileRoute: () => () => ({ component: null }),
    useNavigate: () => navigateMock,
  }
})

const authApiMock = vi.hoisted(() => ({
  login: vi.fn(),
  me: vi.fn(),
}))

const setSessionMock = vi.fn()

vi.mock('#/features/auth/api', () => ({
  authApi: authApiMock,
  toSession: (result: {
    accessToken: string
    refreshToken: string
    user: { email: string; id: string; roles: string[] }
  }) => ({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  }),
}))

vi.mock('#/features/auth/route-gates', () => ({
  GuestOnly: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('#/lib/auth/auth-context', () => ({
  useAuthSession: () => ({
    setSession: setSessionMock,
  }),
}))

const indexModule = await import('./index')

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
  setSessionMock.mockReset()
  Object.values(authApiMock).forEach((mock) => mock.mockReset())
})

function renderLoginScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const LoginScreen = (indexModule as { LoginScreen?: ComponentType }).LoginScreen

  if (!LoginScreen) {
    throw new Error('LoginScreen export is missing')
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen />
    </QueryClientProvider>,
  )
}

describe('LoginScreen', () => {
  it('renders the public brand title and tagline under the logo', async () => {
    authApiMock.login.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        email: 'user@example.com',
        id: 'user-1',
        roles: ['user'],
      },
      wallets: [],
    })
    authApiMock.me.mockResolvedValue({
      email: 'user@example.com',
      id: 'user-1',
      phone: null,
      roles: ['user'],
      telegram: null,
      twoFactorEnabled: false,
    })

    renderLoginScreen()

    expect(await screen.findByText('TÀI KHOẢN TRUNG GIAN')).toBeTruthy()
    expect(screen.getByText('Thanh Toán Trực Tuyến - Ẩn Danh Người Dùng')).toBeTruthy()
  })

  it('shows login errors below the forgot-password link', async () => {
    authApiMock.login.mockRejectedValue({
      response: {
        data: {
          message: 'Dữ liệu gửi lên không hợp lệ.',
        },
      },
    })

    const { container } = renderLoginScreen()

    fireEvent.change(screen.getByPlaceholderText('Email đăng nhập'), {
      target: { value: 'admin@gmail.com' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu'), {
      target: { value: '123456789' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'ĐĂNG NHẬP' }))

    const forgotPasswordLink = container.querySelector('.forgot-password')

    expect(forgotPasswordLink).toBeTruthy()

    const errorMessage = await screen.findByText('Email hoặc mật khẩu không đúng')
    expect(errorMessage).toBeTruthy()
    expect(errorMessage.className).toContain('login-error-message')

    const position = forgotPasswordLink?.compareDocumentPosition(errorMessage)
    expect(position && position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await waitFor(() => {
      expect(authApiMock.login).toHaveBeenCalled()
      expect(authApiMock.login.mock.calls[0]?.[0]).toEqual({
        email: 'admin@gmail.com',
        password: '123456789',
      })
    })
  })
})
