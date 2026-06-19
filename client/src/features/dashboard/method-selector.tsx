import styles from '../../routes/dashboard.module.css'

type DashboardMethodOption = {
  meta: string
  title: string
  value: 'usdt' | 'vnd'
}

export function getDashboardMethodOptions(flow: 'deposit' | 'withdrawal'): DashboardMethodOption[] {
  const withdrawalOptions: DashboardMethodOption[] = [
    {
      meta: 'Chuyển khoản',
      title: 'VNĐ',
      value: 'vnd',
    },
    {
      meta: 'BEP20 / TRC20',
      title: 'USDT',
      value: 'usdt',
    },
  ]

  if (flow === 'deposit') {
    return [withdrawalOptions[0]]
  }

  return withdrawalOptions
}

export function DashboardMethodSelector(props: {
  flow: 'deposit' | 'withdrawal'
  onSelect: (value: 'usdt' | 'vnd') => void
  selectedValue: 'usdt' | 'vnd'
}) {
  const options = getDashboardMethodOptions(props.flow)

  return (
    <div className={styles.tabs}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.tab} ${props.selectedValue === option.value ? styles.active : ''}`}
          onClick={() => props.onSelect(option.value)}
        >
          <span className={styles.tabTitle}>{option.title}</span>
          <span className={styles.tabMeta}>{option.meta}</span>
        </button>
      ))}
    </div>
  )
}
