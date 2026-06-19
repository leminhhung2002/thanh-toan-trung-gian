import { formatUsdt, formatVnd } from '#/lib/utils/format'
import styles from '../../routes/dashboard.module.css'

export function DrawerBalances(props: {
  usdtAvailable: string
  vndAvailable: string
}) {
  return (
    <div
      className={styles.drawerBalances}
      data-balance-pills="true"
      style={{ justifyContent: 'flex-end' }}
    >
      <div
        className={styles.drawerBalancePill}
        data-balance-pill="true"
      >
        {formatVnd(props.vndAvailable)} VNĐ
      </div>
      <div
        className={`${styles.drawerBalancePill} ${styles.drawerBalancePillUsdt}`}
        data-balance-pill="true"
      >
        {formatUsdt(props.usdtAvailable)} USDT
      </div>
    </div>
  )
}
