// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotificationBellButton } from './notification-bell-button'

const notificationsApiMock = vi.hoisted(() => ({
  getUnreadCount: vi.fn(),
}))

vi.mock('./api', () => ({
  notificationsApi: notificationsApiMock,
}))

afterEach(() => {
  cleanup()
  notificationsApiMock.getUnreadCount.mockReset()
})

function renderBellButton() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })
  const onClick = vi.fn()

  const rendered = render(
    <QueryClientProvider client={queryClient}>
      <NotificationBellButton
        ariaLabel="Mở thông báo"
        buttonClassName="mailButton"
        iconClassName="mailIcon"
        onClick={onClick}
      />
    </QueryClientProvider>,
  )

  return {
    ...rendered,
    onClick,
  }
}

describe('NotificationBellButton', () => {
  it('hides the badge when the unread count is zero', async () => {
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 0 })

    renderBellButton()

    await waitFor(() => {
      expect(notificationsApiMock.getUnreadCount).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByRole('button', { name: 'Mở thông báo' })).toBeTruthy()
    expect(screen.queryByText('0')).toBeNull()
  })

  it('shows the exact unread count and preserves button click behavior', async () => {
    notificationsApiMock.getUnreadCount.mockResolvedValue({ count: 5 })

    const { onClick } = renderBellButton()

    expect(await screen.findByText('5')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Mở thông báo' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
