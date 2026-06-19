// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { DepositReservation, FinancialSettings, Profile, WalletSummary } from '#/lib/types'
import { DashboardScreen } from './dashboard-screen'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

const walletApiMock = vi.hoisted(() => ({
  cancelDepositReservation: vi.fn(),
  confirmDepositReservation: vi.fn(),
  createDepositReservation: vi.fn(),
  createWithdrawal: vi.fn(),
  getLedger: vi.fn(),
  getFinancialSettings: vi.fn(),
  listDepositReservations: vi.fn(),
  listWallets: vi.fn(),
}))

const accountApiMock = vi.hoisted(() => ({
  getProfile: vi.fn(),
}))

const notificationsApiMock = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllRead: vi.fn(),
}))

const vietQrBanksMock = vi.hoisted(() => ({
  listVietQrBanks: vi.fn(),
}))

vi.mock('#/features/account/api', () => ({
  accountApi: accountApiMock,
}))

vi.mock('#/features/wallet/api', () => ({
  walletApi: walletApiMock,
}))

vi.mock('#/features/notifications/api', () => ({
  notificationsApi: notificationsApiMock,
}))

vi.mock('#/features/admin/vietqr-banks', () => ({
  listVietQrBanks: vietQrBanksMock.listVietQrBanks,
}))

vi.mock('#/lib/settings/use-display-settings', () => ({
  useDisplaySettings: () => ({
    displaySettings: {
      homepageBanners: [],
      supportLink: 'https://example.com/support',
    },
  }),
}))

vi.mock('#/components/bottom-nav', () => ({
  BottomNav: () => <div data-testid="bottom-nav" />,
}))

vi.mock('#/components/feedback-banner', () => ({
  FeedbackBanner: ({ message }: { kind: 'error' | 'success'; message: string }) => (
    <div>{message}</div>
  ),
}))

vi.mock('#/components/screen-loader', () => ({
  ScreenLoader: () => <div>Đang tải</div>,
}))

vi.mock('#/features/dashboard/drawer-balances', () => ({
  DrawerBalances: () => <div data-testid="drawer-balances" />,
}))

vi.mock('#/features/dashboard/homepage-banner-carousel', () => ({
  HomepageBannerCarousel: ({ fallback }: { fallback: React.ReactNode }) => <div>{fallback}</div>,
}))

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
  Object.values(walletApiMock).forEach((mock) => mock.mockReset())
  Object.values(accountApiMock).forEach((mock) => mock.mockReset())
  Object.values(vietQrBanksMock).forEach((mock) => mock.mockReset())
  Object.values(notificationsApiMock).forEach((mock) => mock.mockReset())
})

function renderDashboardScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardScreen />
    </QueryClientProvider>,
  )
}

function createWallet(assetCode: 'VND' | 'USDT', available: string): WalletSummary {
  return {
    assetCode,
    assetName: assetCode,
    balances: {
      available,
      pending: '0',
      total: available,
    },
    walletId: `wallet-${assetCode.toLowerCase()}`,
  }
}

function createReservation(
  input: Partial<DepositReservation> & Pick<DepositReservation, 'reservationId' | 'status'>,
): DepositReservation {
  return {
    ...input,
    amount: '100000',
    assetCode: 'VND',
    depositRequestId: null,
    depositStatus: null,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    selectedBankAccount: {
      accountName: 'NGUYEN VAN A',
      accountNumber: '0123456789',
      bankCode: 'VCB',
      bankName: 'Vietcombank',
      id: 'bank-1',
      priority: 1,
    },
    transferContent: 'NAP TIEN 123',
  }
}

function mockDashboardDependencies(input?: {
  financialSettings?: FinancialSettings
  profile?: Profile
  reservations?: DepositReservation[]
}) {
  const financialSettings: FinancialSettings = input?.financialSettings ?? {
    exchangeUsdtToVndFeeBps: 0,
    exchangeUsdtToVndMarkupVnd: 0,
    exchangeVndToUsdtFeeBps: 0,
    exchangeVndToUsdtMarkupVnd: 0,
    withdrawalUsdtFeeBps: 0,
    withdrawalVndFeeBps: 0,
  }
  const profile: Profile = input?.profile ?? {
    email: 'user@example.com',
    id: 'user-1',
    phone: null,
    roles: ['user'],
    telegram: null,
    twoFactorEnabled: false,
  }

  walletApiMock.listWallets.mockResolvedValue([
    createWallet('VND', '500000'),
    createWallet('USDT', '25'),
  ])
  accountApiMock.getProfile.mockResolvedValue(profile)
  walletApiMock.getFinancialSettings.mockResolvedValue(financialSettings)
  vietQrBanksMock.listVietQrBanks.mockResolvedValue([
    {
      bin: '970436',
      code: 'VCB',
      id: 1,
      logo: 'https://cdn.vietqr.io/img/VCB.png',
      name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
      shortName: 'Vietcombank',
      transferSupported: 1,
    },
    {
      bin: '970418',
      code: 'BIDV',
      id: 2,
      logo: 'https://cdn.vietqr.io/img/BIDV.png',
      name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
      shortName: 'BIDV',
      transferSupported: 1,
    },
  ])
  notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
  notificationsApiMock.listNotifications.mockResolvedValue({
    items: [],
    unreadCount: 0,
  })
  notificationsApiMock.markAllRead.mockResolvedValue({
    count: 0,
    readAt: '2026-04-12T10:10:00.000Z',
  })

  if (input?.reservations) {
    walletApiMock.listDepositReservations.mockResolvedValue(input.reservations)
  }
}

describe('DashboardScreen', () => {
  it('does not show pending-review deposit requests inside the deposit modal', async () => {
    mockDashboardDependencies({
      reservations: [
        createReservation({
          reservationId: 'reservation-active',
          status: 'active',
        }),
        createReservation({
          depositRequestId: 'deposit-req-1',
          reservationId: 'reservation-pending',
          status: 'pending_review',
        }),
      ],
    })

    renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    fireEvent.click(screen.getByText('Nạp tiền'))

    expect(await screen.findByText('Nạp Tiền')).toBeTruthy()
    await waitFor(() => {
      expect(screen.queryByText('Đang tải thông tin thanh toán...')).toBeNull()
    })
    expect(screen.queryByText('Yêu cầu nạp chờ duyệt')).toBeNull()
    expect(screen.queryByText('Mã yêu cầu')).toBeNull()
  })

  it('opens the shared notification overlay from the mail icon', async () => {
    mockDashboardDependencies()
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 2 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [
        {
          createdAt: '2026-04-06T09:00:00.000Z',
          id: 'exchange-exchange-1',
          primaryAmount: '4.000000',
          primaryAmountTone: 'plus',
          primaryAssetCode: 'USDT',
          referenceId: 'exchange-1',
          referenceType: 'exchange_order',
          secondaryText: 'Đã trừ 100.000 VND',
          title: 'Đổi tiền',
          type: 'exchange.completed',
        },
      ],
      unreadCount: 2,
    })

    renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    expect(await screen.findByText('2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    expect(await screen.findByText('Thông báo')).toBeTruthy()
    expect(await screen.findByText('+4.00 USDT')).toBeTruthy()
    expect(screen.getByText('Đã trừ 100.000 VND')).toBeTruthy()
  })

  it('shows a success card after confirming payment and lets the user continue with a fresh deposit form', async () => {
    walletApiMock.listDepositReservations
      .mockResolvedValueOnce([
        createReservation({
          reservationId: 'reservation-active',
          status: 'active',
        }),
        createReservation({
          depositRequestId: 'deposit-req-1',
          reservationId: 'reservation-pending',
          status: 'pending_review',
        }),
      ])
      .mockResolvedValue([
        createReservation({
          depositRequestId: 'deposit-req-1',
          reservationId: 'reservation-pending',
          status: 'pending_review',
        }),
      ])
    walletApiMock.confirmDepositReservation.mockResolvedValue({
      amount: '100000',
      assetCode: 'VND',
      id: 'deposit-req-1',
      selectedBankAccount: null,
      status: 'pending_review',
    })
    mockDashboardDependencies()

    renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    fireEvent.click(screen.getByText('Nạp tiền'))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận thanh toán' }))

    expect(
      await screen.findByText('Đã ghi nhận thanh toán. Vui lòng chờ xác nhận.'),
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục nạp' })).toBeTruthy()
    expect(screen.queryByAltText('VietQR')).toBeNull()
    expect(screen.queryByText('Yêu cầu nạp chờ duyệt')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục nạp' }))

    expect(screen.getByDisplayValue('10000')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeTruthy()
    expect(screen.queryByText('Đã ghi nhận thanh toán. Vui lòng chờ xác nhận.')).toBeNull()
  })

  it('clears the success card when the deposit modal is closed and opened again', async () => {
    walletApiMock.listDepositReservations
      .mockResolvedValueOnce([
        createReservation({
          reservationId: 'reservation-active',
          status: 'active',
        }),
      ])
      .mockResolvedValue([])
    walletApiMock.confirmDepositReservation.mockResolvedValue({
      amount: '100000',
      assetCode: 'VND',
      id: 'deposit-req-1',
      selectedBankAccount: null,
      status: 'pending_review',
    })
    mockDashboardDependencies()

    const { container } = renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    fireEvent.click(screen.getByText('Nạp tiền'))
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận thanh toán' }))
    await screen.findByText('Đã ghi nhận thanh toán. Vui lòng chờ xác nhận.')

    const closeButton = container.querySelector('button.fas.fa-times') as HTMLButtonElement | null
    expect(closeButton).toBeTruthy()
    fireEvent.click(closeButton as HTMLButtonElement)

    await waitFor(() => {
      expect(screen.queryByText('Nạp Tiền')).toBeNull()
    })

    fireEvent.click(screen.getByText('Nạp tiền'))

    expect(await screen.findByDisplayValue('10000')).toBeTruthy()
    expect(screen.queryByText('Đã ghi nhận thanh toán. Vui lòng chờ xác nhận.')).toBeNull()
  })

  it('treats the withdrawal input as gross debit and fills it with MAX balance', async () => {
    mockDashboardDependencies({
      financialSettings: {
        exchangeUsdtToVndFeeBps: 0,
        exchangeUsdtToVndMarkupVnd: 0,
        exchangeVndToUsdtFeeBps: 0,
        exchangeVndToUsdtMarkupVnd: 0,
        withdrawalUsdtFeeBps: 0,
        withdrawalVndFeeBps: 1000,
      },
    })

    renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    fireEvent.click(screen.getByText('Rút tiền'))

    expect(await screen.findByText('Rút Tiền')).toBeTruthy()
    expect(screen.getByDisplayValue('25000')).toBeTruthy()
    expect(screen.getByText('Bạn sẽ nhận')).toBeTruthy()
    expect(screen.getByText('22.500 VND')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'MAX' }))

    expect(screen.getByDisplayValue('500000')).toBeTruthy()
    expect(screen.getByText('450.000 VND')).toBeTruthy()
  })

  it('uses the shared VietQR bank list for VND withdrawals and submits the selected bank name', async () => {
    walletApiMock.createWithdrawal.mockResolvedValue({
      amount: '450000',
      assetCode: 'VND',
      feeAmount: '50000',
      id: 'withdrawal-1',
      status: 'pending',
      totalDebit: '500000',
    })
    mockDashboardDependencies({
      financialSettings: {
        exchangeUsdtToVndFeeBps: 0,
        exchangeUsdtToVndMarkupVnd: 0,
        exchangeVndToUsdtFeeBps: 0,
        exchangeVndToUsdtMarkupVnd: 0,
        withdrawalUsdtFeeBps: 0,
        withdrawalVndFeeBps: 1000,
      },
    })

    renderDashboardScreen()

    await screen.findByText('Tài khoản trung gian')
    fireEvent.click(screen.getByText('Rút tiền'))

    expect(await screen.findByRole('option', { name: 'Vietcombank (970436)' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Ngân hàng thụ hưởng'), {
      target: { value: 'Vietcombank' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập số tài khoản'), {
      target: { value: '0123456789' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập tên chủ tài khoản'), {
      target: { value: 'NGUYEN VAN A' },
    })
    fireEvent.change(screen.getByPlaceholderText('Nhập mật khẩu hiện tại'), {
      target: { value: 'Secret123!' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Tạo yêu cầu rút tiền' }))

    await waitFor(() => {
      expect(walletApiMock.createWithdrawal).toHaveBeenCalled()
      expect(walletApiMock.createWithdrawal.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          amount: '25000',
          assetCode: 'VND',
          destinationDetails: {
            accountName: 'NGUYEN VAN A',
            accountNumber: '0123456789',
            bankName: 'Vietcombank',
            method: 'bank_transfer',
          },
          method: 'bank_transfer',
          currentPassword: 'Secret123!',
        }),
      )
    })

    expect(
      screen.queryByText(/Yêu cầu rút tiền đã được tạo\. Tổng tiền bị giữ là/i),
    ).toBeNull()
  })
})
