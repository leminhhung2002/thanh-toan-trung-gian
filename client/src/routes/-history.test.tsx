// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HistoryListItem, HistorySnapshot } from '#/features/history/api'

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    createFileRoute: () => () => ({ component: null }),
  }
})

const notificationsApiMock = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
  listNotifications: vi.fn(),
  markAllRead: vi.fn(),
}))

const historyApiMock = vi.hoisted(() => ({
  cancelPendingDeposit: vi.fn(),
  cancelPendingWithdrawal: vi.fn(),
  getHistorySnapshot: vi.fn(),
}))

vi.mock('#/features/history/api', () => ({
  cancelPendingDeposit: historyApiMock.cancelPendingDeposit,
  cancelPendingWithdrawal: historyApiMock.cancelPendingWithdrawal,
  getHistorySnapshot: historyApiMock.getHistorySnapshot,
}))

vi.mock('#/features/notifications/api', () => ({
  notificationsApi: notificationsApiMock,
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

const { HistoryScreen } = await import('./history')

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  historyApiMock.getHistorySnapshot.mockReset()
  historyApiMock.cancelPendingDeposit.mockReset()
  historyApiMock.cancelPendingWithdrawal.mockReset()
  Object.values(notificationsApiMock).forEach((mock) => mock.mockReset())
})

function renderHistoryScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <HistoryScreen />
    </QueryClientProvider>,
  )
}

function createHistorySnapshot(items: HistoryListItem[]): HistorySnapshot {
  return {
    items,
    totalDepositVnd: 100000,
    totalWithdrawUsdt: 11,
    totalWithdrawVnd: 52500,
    wallets: [
      {
        assetCode: 'VND',
        assetName: 'VND',
        balances: { available: '300000', pending: '0', total: '300000' },
        walletId: 'wallet-vnd',
      },
      {
        assetCode: 'USDT',
        assetName: 'USDT',
        balances: { available: '25', pending: '0', total: '25' },
        walletId: 'wallet-usdt',
      },
    ],
  }
}

function createRecentIso(offsetMinutes: number) {
  return new Date(Date.now() - offsetMinutes * 60 * 1000).toISOString()
}

describe('HistoryScreen', () => {
  it('filters the visible transaction list by deposit, withdrawal, and exchange kinds', async () => {
    historyApiMock.getHistorySnapshot.mockResolvedValue(
      createHistorySnapshot([
        {
          amount: '100000',
          assetCode: 'VND',
          createdAt: createRecentIso(10),
          destinationRef: 'NAPTIEN001',
          id: 'deposit-1',
          kind: 'deposit',
          method: 'bank_transfer',
          status: 'approved',
        },
        {
          amount: '50000',
          assetCode: 'VND',
          createdAt: createRecentIso(20),
          destinationDetails: {
            accountName: 'NGUYEN VAN A',
            accountNumber: '123456789',
            bankName: 'Vietcombank',
            method: 'bank_transfer',
          },
          feeAmount: '2500',
          id: 'withdrawal-1',
          kind: 'withdrawal',
          method: 'bank_transfer',
          status: 'approved',
          totalDebit: '52500',
        },
        {
          amount: '4.000000',
          assetCode: 'USDT',
          createdAt: createRecentIso(30),
          fromAssetCode: 'VND',
          id: 'exchange-1',
          kind: 'exchange',
          rate: '25000',
          requestedAmount: '100000',
          status: 'completed',
          totalDebit: '100000',
        },
      ]),
    )
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    expect(await screen.findByText('Lịch sử giao dịch')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tất cả' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Nạp tiền' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Rút tiền' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Đổi tiền' })).toBeTruthy()

    expect(screen.getByText('NAPTIEN001')).toBeTruthy()
    expect(screen.getByText('Vietcombank - 123456789')).toBeTruthy()
    expect(screen.getByText('25.000 VND / 1 USDT')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Nạp tiền' }))
    expect(screen.getByText('NAPTIEN001')).toBeTruthy()
    expect(screen.queryByText('Vietcombank - 123456789')).toBeNull()
    expect(screen.queryByText('25.000 VND / 1 USDT')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Rút tiền' }))
    expect(screen.queryByText('NAPTIEN001')).toBeNull()
    expect(screen.getByText('Vietcombank - 123456789')).toBeTruthy()
    expect(screen.queryByText('25.000 VND / 1 USDT')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Đổi tiền' }))
    expect(screen.queryByText('NAPTIEN001')).toBeNull()
    expect(screen.queryByText('Vietcombank - 123456789')).toBeNull()
    expect(screen.getByText('25.000 VND / 1 USDT')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Tất cả' }))
    expect(screen.getByText('NAPTIEN001')).toBeTruthy()
    expect(screen.getByText('Vietcombank - 123456789')).toBeTruthy()
    expect(screen.getByText('25.000 VND / 1 USDT')).toBeTruthy()
  })

  it('opens the notification overlay from the mail icon and loads notifications lazily', async () => {
    historyApiMock.getHistorySnapshot.mockResolvedValue({
      items: [],
      totalDepositVnd: 0,
      totalWithdrawUsdt: 0,
      totalWithdrawVnd: 0,
      wallets: [
        {
          assetCode: 'VND',
          assetName: 'VND',
          balances: { available: '0', pending: '0', total: '0' },
          walletId: 'wallet-vnd',
        },
        {
          assetCode: 'USDT',
          assetName: 'USDT',
          balances: { available: '0', pending: '0', total: '0' },
          walletId: 'wallet-usdt',
        },
      ],
    })
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 1 })
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
      unreadCount: 1,
    })

    renderHistoryScreen()

    expect(await screen.findByText('Lịch sử giao dịch')).toBeTruthy()
    expect(notificationsApiMock.listNotifications).not.toHaveBeenCalled()
    expect(await screen.findByText('1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    expect(await screen.findByText('Thông báo')).toBeTruthy()
    expect(await screen.findByText('+4.00 USDT')).toBeTruthy()
    expect(screen.getByText('Đã trừ 100.000 VND')).toBeTruthy()

    await waitFor(() => {
      expect(notificationsApiMock.listNotifications).toHaveBeenCalledTimes(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))

    await waitFor(() => {
      expect(screen.queryByText('Thông báo')).toBeNull()
    })
  })

  it('refreshes the history snapshot every 5 seconds while the screen stays open', async () => {
    vi.useFakeTimers()
    historyApiMock.getHistorySnapshot.mockResolvedValue(createHistorySnapshot([]))
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })
    expect(screen.getByText('Lịch sử giao dịch')).toBeTruthy()
    expect(historyApiMock.getHistorySnapshot).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(historyApiMock.getHistorySnapshot).toHaveBeenCalledTimes(2)
  })

  it('refreshes notifications every 5 seconds only while the overlay remains open', async () => {
    vi.useFakeTimers()
    historyApiMock.getHistorySnapshot.mockResolvedValue(createHistorySnapshot([]))
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
      await Promise.resolve()
    })
    expect(screen.getByText('Lịch sử giao dịch')).toBeTruthy()
    expect(notificationsApiMock.listNotifications).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(notificationsApiMock.listNotifications).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(notificationsApiMock.listNotifications).toHaveBeenCalledTimes(2)

    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByText('Thông báo')).toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(notificationsApiMock.listNotifications).toHaveBeenCalledTimes(2)
  })

  it('shows a compact empty state when there are no notifications', async () => {
    historyApiMock.getHistorySnapshot.mockResolvedValue({
      items: [],
      totalDepositVnd: 0,
      totalWithdrawUsdt: 0,
      totalWithdrawVnd: 0,
      wallets: [
        {
          assetCode: 'VND',
          assetName: 'VND',
          balances: { available: '0', pending: '0', total: '0' },
          walletId: 'wallet-vnd',
        },
      ],
    })
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    await screen.findByText('Lịch sử giao dịch')
    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    expect(await screen.findByText('Chưa có thông báo')).toBeTruthy()
  })

  it('shows the empty transaction state when the selected filter has no matching items', async () => {
    historyApiMock.getHistorySnapshot.mockResolvedValue(
      createHistorySnapshot([
        {
          amount: '75000',
          assetCode: 'VND',
          createdAt: createRecentIso(10),
          destinationRef: 'NAPTIEN002',
          id: 'deposit-2',
          kind: 'deposit',
          method: 'bank_transfer',
          status: 'approved',
        },
      ]),
    )
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    expect(await screen.findByText('Lịch sử giao dịch')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Rút tiền' }))

    expect(screen.getByText('Không có giao dịch')).toBeTruthy()
    expect(screen.queryByText('NAPTIEN002')).toBeNull()
  })

  it('shows a cancel button for pending deposit and withdrawal items and triggers the correct cancel action after confirmation', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    historyApiMock.getHistorySnapshot.mockResolvedValue(
      createHistorySnapshot([
        {
          amount: '75000',
          assetCode: 'VND',
          createdAt: createRecentIso(10),
          destinationRef: 'NAPTIEN003',
          id: 'deposit-pending',
          kind: 'deposit',
          method: 'bank_transfer',
          status: 'pending',
        },
        {
          amount: '50000',
          assetCode: 'VND',
          createdAt: createRecentIso(20),
          destinationDetails: {
            accountName: 'NGUYEN VAN A',
            accountNumber: '123456789',
            bankName: 'Vietcombank',
            method: 'bank_transfer',
          },
          feeAmount: '2500',
          id: 'withdrawal-pending',
          kind: 'withdrawal',
          method: 'bank_transfer',
          status: 'pending',
          totalDebit: '52500',
        },
        {
          amount: '100000',
          assetCode: 'VND',
          createdAt: createRecentIso(30),
          destinationRef: 'NAPTIEN004',
          id: 'deposit-approved',
          kind: 'deposit',
          method: 'bank_transfer',
          status: 'approved',
        },
      ]),
    )
    historyApiMock.cancelPendingDeposit.mockResolvedValue({ success: true })
    historyApiMock.cancelPendingWithdrawal.mockResolvedValue({ success: true })
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [],
      unreadCount: 0,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderHistoryScreen()

    expect(await screen.findByText('Lịch sử giao dịch')).toBeTruthy()

    const cancelButtons = screen.getAllByRole('button', { name: 'Hủy giao dịch' })
    expect(cancelButtons).toHaveLength(2)

    fireEvent.click(cancelButtons[0])
    await waitFor(() => {
      expect(historyApiMock.cancelPendingDeposit).toHaveBeenCalledWith(
        'deposit-pending',
        expect.anything(),
      )
    })

    fireEvent.click(cancelButtons[1])
    await waitFor(() => {
      expect(historyApiMock.cancelPendingWithdrawal).toHaveBeenCalledWith(
        'withdrawal-pending',
        expect.anything(),
      )
    })

    expect(screen.queryByText('deposit-approved')).toBeNull()
    expect(confirmSpy).toHaveBeenCalledTimes(2)
    confirmSpy.mockRestore()
  })
})
