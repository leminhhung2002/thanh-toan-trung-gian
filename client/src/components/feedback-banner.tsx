import styles from './feedback-banner.module.css'

export function FeedbackBanner({
  kind,
  message,
}: {
  kind: 'error' | 'success'
  message: string
}) {
  return (
    <div
      className={`${styles.banner} ${kind === 'success' ? styles.success : styles.error}`}
      role="status"
    >
      <i
        className={
          kind === 'success'
            ? 'fas fa-check-circle'
            : 'fas fa-exclamation-circle'
        }
      />
      <span>{message}</span>
    </div>
  )
}
