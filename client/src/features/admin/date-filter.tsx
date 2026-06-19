import type { LegacyAdminTabId } from './ui'
import styles from '../../routes/admin.module.css'

export type AdminDateRange = {
  fromDate: string
  toDate: string
}

const ISO_DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export function shouldShowAdminDateFilter(tab: LegacyAdminTabId) {
  return (
    tab === 'overview' ||
    tab === 'transactions' ||
    tab === 'withdrawals' ||
    tab === 'exchange'
  )
}

export function isAdminDateRangeValid(range: AdminDateRange) {
  return (
    ISO_DAY_PATTERN.test(range.fromDate) &&
    ISO_DAY_PATTERN.test(range.toDate) &&
    range.fromDate <= range.toDate
  )
}

export function getAdminDateRangeError(range: AdminDateRange) {
  if (!range.fromDate && !range.toDate) {
    return ''
  }

  if (!range.fromDate || !range.toDate) {
    return 'Vui lòng chọn đủ từ ngày và đến ngày.'
  }

  if (!isAdminDateRangeValid(range)) {
    return 'Khoảng ngày không hợp lệ.'
  }

  return ''
}

export function getNextEffectiveAdminDateRange(
  current: AdminDateRange,
  draft: AdminDateRange,
) {
  return isAdminDateRangeValid(draft) ? draft : current
}

export function AdminDateFilter(props: {
  errorMessage?: string
  fromDate: string
  fromId: string
  onFromDateChange: (value: string) => void
  onToDateChange: (value: string) => void
  toDate: string
  toId: string
}) {
  return (
    <div className={styles.toolbarDateFilterGroup}>
      <div className={styles.toolbarDateFilter}>
        <div className={styles.toolbarDateField}>
          <label className={styles.toolbarDateLabel} htmlFor={props.fromId}>
            Từ ngày
          </label>
          <input
            id={props.fromId}
            className={styles.toolbarDateInput}
            type="date"
            value={props.fromDate}
            onChange={(event) => props.onFromDateChange(event.target.value)}
          />
        </div>
        <div className={styles.toolbarDateField}>
          <label className={styles.toolbarDateLabel} htmlFor={props.toId}>
            Đến ngày
          </label>
          <input
            id={props.toId}
            className={styles.toolbarDateInput}
            type="date"
            value={props.toDate}
            onChange={(event) => props.onToDateChange(event.target.value)}
          />
        </div>
      </div>
      {props.errorMessage ? (
        <div className={styles.toolbarDateError}>{props.errorMessage}</div>
      ) : null}
    </div>
  )
}
