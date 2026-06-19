import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('#/lib/api/app-client', () => ({
  apiClient: {
    get: mocks.get,
    post: mocks.post,
  },
}))

const { notificationsApi } = await import('./api')

describe('notifications api helpers', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.post.mockReset()
  })

  it('loads the latest notifications list with the requested limit', async () => {
    mocks.get.mockResolvedValueOnce({
      items: [],
      unreadCount: 0,
    })

    await notificationsApi.listNotifications(50)

    expect(mocks.get).toHaveBeenCalledWith('/notifications?limit=50', {
      auth: true,
    })
  })

  it('loads the unread count and marks notifications as read', async () => {
    mocks.get.mockResolvedValueOnce({ count: 3 })
    mocks.post.mockResolvedValueOnce({
      count: 0,
      readAt: '2026-04-12T10:10:00.000Z',
    })

    await notificationsApi.getUnreadCount()
    await notificationsApi.markAllRead()

    expect(mocks.get).toHaveBeenCalledWith('/notifications/unread-count', {
      auth: true,
    })
    expect(mocks.post).toHaveBeenCalledWith(
      '/notifications/read-all',
      {},
      { auth: true },
    )
  })
})
