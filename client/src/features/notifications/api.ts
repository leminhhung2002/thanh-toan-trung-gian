import { apiClient } from '#/lib/api/app-client'
import type {
  NotificationListResponse,
  ReadAllNotificationsResponse,
  UnreadCountResponse,
} from '#/lib/types'

export const notificationsApi = {
  getUnreadCount: () =>
    apiClient.get<UnreadCountResponse>('/notifications/unread-count', {
      auth: true,
    }),
  listNotifications: (limit = 50) =>
    apiClient.get<NotificationListResponse>(`/notifications?limit=${limit}`, {
      auth: true,
    }),
  markAllRead: () =>
    apiClient.post<ReadAllNotificationsResponse, Record<string, never>>(
      '/notifications/read-all',
      {},
      { auth: true },
    ),
}
