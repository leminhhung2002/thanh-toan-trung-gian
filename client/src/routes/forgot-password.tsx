import { createFileRoute, Link } from '@tanstack/react-router'
import { GuestOnly } from '#/features/auth/route-gates'
import { getForgotPasswordUnavailableUiCopy } from '#/features/auth/ui'
import { useDisplaySettings } from '#/lib/settings/use-display-settings'
import styles from './forgot-password.module.css'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordRoute,
})

function ForgotPasswordRoute() {
  return (
    <GuestOnly>
      <ForgotPasswordScreen />
    </GuestOnly>
  )
}

function ForgotPasswordScreen() {
  const { displaySettings } = useDisplaySettings()
  const forgotPasswordUiCopy = getForgotPasswordUnavailableUiCopy(
    displaySettings.supportLink,
  )

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.header}>
          <div className={styles.backButtonWrapper}>
            <Link to="/">
              <button className={styles.backButton} type="button">
                <i className="fas fa-arrow-left"></i>
              </button>
            </Link>
          </div>
          <h1 className={styles.titleMain}>Quên mật khẩu</h1>
          <p className={styles.titleSub}>Vui lòng liên hệ hỗ trợ để được xử lí.</p>
        </div>

        <div className={styles.methodCard}>
          <div className={styles.iconWrapper}>
            <i className="far fa-envelope"></i>
          </div>
          <div className={styles.cardContent}>
            <div className={styles.cardTitle}>{forgotPasswordUiCopy.title}</div>
            {forgotPasswordUiCopy.body ? (
              <div className={styles.cardDesc}>{forgotPasswordUiCopy.body}</div>
            ) : null}
            <a
              className={styles.supportButton}
              href={forgotPasswordUiCopy.supportHref}
              rel="noreferrer"
              target="_blank"
            >
              {forgotPasswordUiCopy.supportText}
            </a>
          </div>
        </div>

        <div className={styles.footer}>
          <a
            href={displaySettings.supportLink}
            className={styles.contactLink}
            target="_blank"
            rel="noreferrer"
          >
            LIÊN HỆ HỖ TRỢ
          </a>
        </div>
      </div>
    </div>
  )
}
