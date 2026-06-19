import styles from '../../routes/dashboard.module.css'

export function WithdrawAmountField(props: {
  feeHint: string
  label: string
  onChange: (value: string) => void
  onMax: () => void
  value: string
}) {
  return (
    <div className={styles.inputGroup}>
      <div className={styles.fieldHeader} data-testid="withdraw-amount-header">
        <div className={styles.label}>{props.label}</div>
        <div className={styles.withdrawFeeHint}>{props.feeHint}</div>
      </div>
      <div className={styles.inputActionRow}>
        <input
          type="number"
          className={`${styles.inputField} ${styles.inputFieldWithAction}`}
          placeholder="Nhập số tiền muốn rút"
          value={props.value}
          onChange={(event) => props.onChange(event.target.value)}
        />
        <button className={styles.maxBtn} onClick={props.onMax} type="button">
          MAX
        </button>
      </div>
    </div>
  )
}
