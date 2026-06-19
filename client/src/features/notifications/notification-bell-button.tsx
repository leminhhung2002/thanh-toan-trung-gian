import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from './api'
import { queryKeys } from '#/lib/query-keys'
import styles from './notification-bell-button.module.css'

type NotificationBellButtonProps = {
  ariaLabel: string
  buttonClassName?: string
  iconClassName?: string
  onClick: () => void
}

export function NotificationBellButton({
  ariaLabel,
  buttonClassName,
  iconClassName,
  onClick,
}: NotificationBellButtonProps) {
  const unreadCountQuery = useQuery({
    queryKey: queryKeys.notificationUnreadCount,
    queryFn: notificationsApi.getUnreadCount,
    refetchInterval: 10_000,
  })
  const unreadCount = unreadCountQuery.data?.count ?? 0

  return (
    <button
      aria-label={ariaLabel}
      className={[buttonClassName, styles.button].filter(Boolean).join(' ')}
      onClick={onClick}
      type="button"
    >
      <i className={['far fa-envelope', iconClassName].filter(Boolean).join(' ')}></i>
      {unreadCount > 0 ? <span className={styles.badge}>{unreadCount}</span> : null}
    </button>
  )
}
