import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '#/features/notifications/api'
import { queryKeys } from '#/lib/query-keys'
import type { NotificationItem } from '#/lib/types'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import styles from './notification-overlay.module.css'

export function NotificationHistoryOverlay(props: {
  onClose: () => void
  open: boolean
}) {
  const queryClient = useQueryClient()
  const [hasMarkedCurrentOpen, setHasMarkedCurrentOpen] = useState(false)
  const notificationsQuery = useQuery({
    enabled: props.open,
    queryKey: queryKeys.notifications(50),
    queryFn: () => notificationsApi.listNotifications(50),
    refetchInterval: props.open ? 5_000 : false,
  })
  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.notificationUnreadCount, { count: result.count })
      queryClient.setQueryData(
        queryKeys.notifications(50),
        (current: { items: NotificationItem[]; unreadCount: number } | undefined) =>
          current
            ? {
                ...current,
                unreadCount: result.count,
              }
            : current,
      )
    },
  })

  useEffect(() => {
    if (!props.open) {
      setHasMarkedCurrentOpen(false)
    }
  }, [props.open])

  useEffect(() => {
    if (!props.open || !notificationsQuery.isSuccess || hasMarkedCurrentOpen) {
      return
    }

    setHasMarkedCurrentOpen(true)
    markAllReadMutation.mutate()
  }, [
    hasMarkedCurrentOpen,
    markAllReadMutation,
    notificationsQuery.isSuccess,
    props.open,
  ])

  if (!props.open) {
    return null
  }

  const items = notificationsQuery.data?.items ?? []

  return (
    <div className={styles.overlay} onClick={props.onClose}>
      <div
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.title}>Thông báo</div>
          <button
            aria-label="Đóng thông báo"
            className={styles.close}
            onClick={props.onClose}
            type="button"
          >
            <i className="fas fa-times" />
          </button>
        </div>

        {notificationsQuery.isPending ? (
          <div className={styles.emptyState}>Đang tải thông báo...</div>
        ) : notificationsQuery.isError ? (
          <div className={styles.emptyState}>Không thể tải thông báo.</div>
        ) : items.length > 0 ? (
          <div className={styles.list}>
            {items.map((item) => (
              <div className={styles.item} key={item.id}>
                <div className={styles.meta}>
                  <div className={styles.textBlock}>
                    <div className={styles.itemTitle}>{item.title}</div>
                    <div className={styles.date}>
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div
                    className={`${styles.amount} ${
                      item.primaryAmountTone === 'plus'
                        ? styles.amountPlus
                        : item.primaryAmountTone === 'minus'
                          ? styles.amountMinus
                          : styles.amountNeutral
                    }`}
                  >
                    {formatNotificationPrimaryAmount(item)}
                  </div>
                </div>
                <div className={styles.secondaryText}>{item.secondaryText}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>Chưa có thông báo</div>
        )}
      </div>
    </div>
  )
}

function formatNotificationPrimaryAmount(item: NotificationItem) {
  const sign =
    item.primaryAmountTone === 'plus'
      ? '+'
      : item.primaryAmountTone === 'minus'
        ? '-'
        : ''

  if (item.primaryAssetCode === 'VND') {
    return `${sign}${formatVnd(item.primaryAmount)} ${item.primaryAssetCode}`
  }

  return `${sign}${formatUsdt(item.primaryAmount)} ${item.primaryAssetCode}`
}
