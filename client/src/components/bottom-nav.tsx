import { Link } from '@tanstack/react-router'
import { useDisplaySettings } from '#/lib/settings/use-display-settings'
import styles from './bottom-nav.module.css'

type BottomNavProps = {
  active: 'account' | 'dashboard' | 'history'
}

export function BottomNav({ active }: BottomNavProps) {
  const { displaySettings } = useDisplaySettings()

  return (
    <div className={styles.bottomNav}>
      <Link
        to="/dashboard"
        className={`${styles.navItem} ${active === 'dashboard' ? styles.active : ''}`}
      >
        <i className="fas fa-laptop-house"></i>
        <span>Trang chủ</span>
      </Link>
      <Link
        to="/history"
        className={`${styles.navItem} ${active === 'history' ? styles.active : ''}`}
      >
        <i className="far fa-calendar-alt"></i>
        <span>Lịch sử</span>
      </Link>
      <a
        href={displaySettings.supportLink}
        target="_blank"
        rel="noreferrer"
        className={styles.navItem}
      >
        <i className="fas fa-headset"></i>
        <span>hỗ trợ</span>
        <div className={styles.badgeIcon}>
          <i className="fas fa-search" style={{ fontSize: '6px', margin: 0 }}></i>
        </div>
      </a>
      <Link
        to="/account"
        className={`${styles.navItem} ${active === 'account' ? styles.active : ''}`}
      >
        <i className="far fa-user"></i>
        <span>Tài khoản</span>
      </Link>
    </div>
  )
}
