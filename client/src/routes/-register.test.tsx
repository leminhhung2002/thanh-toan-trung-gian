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
    Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    createFileRoute: () => () => ({ component: null }),
    useNavigate: () => navigateMock,
  }
})

const authApiMock = vi.hoisted(() => ({
  me: vi.fn(),
  register: vi.fn(),
}))

const setSessionMock = vi.fn()

vi.mock('#/features/auth/api', () => ({
  authApi: authApiMock,
  toSession: (result: { accessToken: string; refreshToken: string; user: { email: string; id: string; roles: string[] } }) => ({
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

const registerModule = await import('./register')

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
  setSessionMock.mockReset()
  Object.values(authApiMock).forEach((mock) => mock.mockReset())
})

function renderRegisterScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  const RegisterScreen = (registerModule as { RegisterScreen?: ComponentType }).RegisterScreen

  if (!RegisterScreen) {
    throw new Error('RegisterScreen export is missing')
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <RegisterScreen />
    </QueryClientProvider>,
  )
}

describe('RegisterScreen', () => {
  it('renders a telegram username field and submits it during registration', async () => {
    authApiMock.register.mockResolvedValue({
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
      phone: '0901234567',
      roles: ['user'],
      telegram: 'walletuser',
      twoFactorEnabled: false,
    })

    renderRegisterScreen()

    expect(await screen.findByText('ĐĂNG KÝ TÀI KHOẢN CÁ NHÂN')).toBeTruthy()

    fireEvent.change(screen.getAllByPlaceholderText('Nhập')[0], {
      target: { value: 'user@example.com' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('Nhập')[1], {
      target: { value: 'Secret123!' },
    })
    fireEvent.change(screen.getAllByPlaceholderText('Nhập')[2], {
      target: { value: '0901234567' },
    })
    fireEvent.change(screen.getByPlaceholderText('Username Telegram'), {
      target: { value: 'https://t.me/walletuser' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))

    await waitFor(() => {
      expect(authApiMock.register).toHaveBeenCalled()
      expect(authApiMock.register.mock.calls[0]?.[0]).toEqual({
        email: 'user@example.com',
        password: 'Secret123!',
        phone: '0901234567',
        telegram: 'https://t.me/walletuser',
      })
    })
  })
})
