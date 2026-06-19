import styles from '../../routes/admin.module.css'

type ManualRefreshButtonProps = {
  className?: string
  isRefreshing: boolean
  onClick: () => void
}

export function ManualRefreshButton({
  className,
  isRefreshing,
  onClick,
}: ManualRefreshButtonProps) {
  const buttonClassName = [styles.refreshBtn, className].filter(Boolean).join(' ')

  return (
    <button
      className={buttonClassName}
      disabled={isRefreshing}
      onClick={onClick}
      type="button"
    >
      <i className="fas fa-sync-alt" />
      {isRefreshing ? 'Đang tải...' : 'Làm mới'}
    </button>
  )
}
