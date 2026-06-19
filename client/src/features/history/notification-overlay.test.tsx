// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationHistoryOverlay } from './notification-overlay'

const notificationsApiMock = vi.hoisted(() => ({
  listNotifications: vi.fn(),
  markAllRead: vi.fn(),
}))

vi.mock('#/features/notifications/api', () => ({
  notificationsApi: notificationsApiMock,
}))

afterEach(() => {
  cleanup()
  notificationsApiMock.listNotifications.mockReset()
  notificationsApiMock.markAllRead.mockReset()
})

function renderOverlay(open = true) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationHistoryOverlay onClose={() => undefined} open={open} />
    </QueryClientProvider>,
  )
}

describe('NotificationHistoryOverlay', () => {
  it('marks notifications as read only after the list loads successfully', async () => {
    notificationsApiMock.listNotifications.mockResolvedValue({
      items: [
        {
          createdAt: '2026-04-12T10:10:00.000Z',
          id: 'notification-1',
          primaryAmount: '250000',
          primaryAmountTone: 'neutral',
          primaryAssetCode: 'VND',
          referenceId: 'deposit-1',
          referenceType: 'deposit_request',
          secondaryText: 'Yêu cầu nạp tiền đã bị từ chối',
          title: 'Nạp tiền',
          type: 'deposit.rejected',
        },
      ],
      unreadCount: 1,
    })
    notificationsApiMock.markAllRead.mockResolvedValue({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    renderOverlay()

    expect(await screen.findByText('Thông báo')).toBeTruthy()
    expect(await screen.findByText('250.000 VND')).toBeTruthy()
    expect(screen.getByText('Yêu cầu nạp tiền đã bị từ chối')).toBeTruthy()

    await waitFor(() => {
      expect(notificationsApiMock.markAllRead).toHaveBeenCalledTimes(1)
    })
  })

  it('does not mark notifications as read when the list request fails', async () => {
    notificationsApiMock.listNotifications.mockRejectedValue(new Error('Request failed'))

    renderOverlay()

    await waitFor(() => {
      expect(notificationsApiMock.listNotifications).toHaveBeenCalledTimes(1)
    })
    expect(notificationsApiMock.markAllRead).not.toHaveBeenCalled()
  })
})
