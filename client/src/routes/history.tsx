import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { BottomNav } from '#/components/bottom-nav'
import { ScreenLoader } from '#/components/screen-loader'
import { NotificationBellButton } from '#/features/notifications/notification-bell-button'
import {
  cancelPendingDeposit,
  cancelPendingWithdrawal,
  getHistorySnapshot,
  type HistoryListItem,
} from '#/features/history/api'
import { NotificationHistoryOverlay } from '#/features/history/notification-overlay'
import {
  canCancelHistoryItem,
  describeHistoryItem,
  filterVisibleHistoryItems,
  getHistoryStatusBadge,
} from '#/features/history/ui'
import { getHistoryPollingOptions } from '#/features/history/polling'
import { RequireUser } from '#/features/auth/route-gates'
import { translateApiError } from '#/lib/api/error-copy'
import { queryKeys } from '#/lib/query-keys'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import { findWalletByAssetCode } from '#/lib/utils/wallets'
import styles from './history.module.css'

type HistoryFilterKind = 'all' | 'deposit' | 'exchange' | 'withdrawal'

const HISTORY_FILTER_OPTIONS: Array<{
  kind: HistoryFilterKind
  label: string
}> = [
  { kind: 'all', label: 'Tất cả' },
  { kind: 'deposit', label: 'Nạp tiền' },
  { kind: 'withdrawal', label: 'Rút tiền' },
  { kind: 'exchange', label: 'Đổi tiền' },
]

export const Route = createFileRoute('/history')({
  component: HistoryRoute,
})

function HistoryRoute() {
  return (
    <RequireUser>
      <HistoryScreen />
    </RequireUser>
  )
}

export function HistoryScreen() {
  const [selectedFilter, setSelectedFilter] = useState<HistoryFilterKind>('all')
  const [showNotifications, setShowNotifications] = useState(false)
  const [cancellingItemKey, setCancellingItemKey] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const cancelDepositMutation = useMutation({
    mutationFn: cancelPendingDeposit,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
        queryClient.invalidateQueries({ queryKey: queryKeys.depositReservations }),
        queryClient.invalidateQueries({
          queryKey: queryKeys.currentDepositReservation,
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(50) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
      ])
    },
  })
  const cancelWithdrawalMutation = useMutation({
    mutationFn: cancelPendingWithdrawal,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
        queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(50) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
      ])
    },
  })
  const historyQuery = useQuery({
    queryKey: queryKeys.history,
    queryFn: getHistorySnapshot,
    ...getHistoryPollingOptions(),
  })
  if (historyQuery.isPending) {
    return <ScreenLoader />
  }

  const snapshot = historyQuery.data

  if (!snapshot) {
    return <ScreenLoader message="Không thể tải lịch sử giao dịch." />
  }

  const vndWallet = findWalletByAssetCode(snapshot.wallets, 'VND')
  const usdtWallet = findWalletByAssetCode(snapshot.wallets, 'USDT')
  const visibleItems = filterVisibleHistoryItems(snapshot.items)
  const filteredItems = visibleItems.filter((item) =>
    selectedFilter === 'all' ? true : item.kind === selectedFilter,
  )

  const handleCancel = async (item: HistoryListItem) => {
    const title = item.kind === 'deposit' ? 'giao dịch nạp tiền' : 'yêu cầu rút tiền'

    if (!window.confirm(`Bạn có chắc muốn hủy ${title} này?`)) {
      return
    }

    const itemKey = `${item.kind}-${item.id}`
    setCancellingItemKey(itemKey)

    try {
      if (item.kind === 'deposit') {
        await cancelDepositMutation.mutateAsync(item.id)
      } else if (item.kind === 'withdrawal') {
        await cancelWithdrawalMutation.mutateAsync(item.id)
      }
    } catch (error) {
      window.alert(translateApiError(error, 'Không thể hủy giao dịch này'))
    } finally {
      setCancellingItemKey(null)
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>Lịch sử giao dịch</div>
        <NotificationBellButton
          ariaLabel="Mở thông báo"
          buttonClassName={styles.mailButton}
          iconClassName={styles.mailIcon}
          onClick={() => setShowNotifications(true)}
        />
      </div>

      <div className={styles.cardArea}>
        <div className={styles.historyCard}>
          <div className={styles.cornerTopRight}></div>
          <div className={styles.cornerTopRightOrange}></div>
          <div className={styles.cornerBottomLeft}></div>
          <div className={styles.cornerBottomLeftOrange}></div>

          <div className={styles.cardInner}>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>TỔNG NẠP VND</span>
              <span className={styles.statValue}>
                {formatVnd(snapshot.totalDepositVnd)} đ
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>TỔNG RÚT VND</span>
              <span className={styles.statValue}>
                {formatVnd(snapshot.totalWithdrawVnd)} đ
              </span>
            </div>
            <div className={styles.statRow}>
              <span className={styles.statLabel}>TỔNG RÚT USDT</span>
              <span className={styles.statValue}>
                {formatUsdt(snapshot.totalWithdrawUsdt)} USDT
              </span>
            </div>

            <div className={styles.divider}></div>

            <div className={styles.balanceTitle}>Số dư tài khoản</div>

            <div className={styles.balanceRow}>
              <span className={styles.balanceCurrencyTag}>VND</span>
              <span className={styles.balanceAmount}>
                {formatVnd(vndWallet?.balances.available ?? '0')}
              </span>
            </div>

            <div className={styles.balanceRow}>
              <span className={`${styles.balanceCurrencyTag} ${styles.tagUsdt}`}>USDT</span>
              <span className={styles.balanceAmount}>
                {formatUsdt(usdtWallet?.balances.available ?? '0')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        {HISTORY_FILTER_OPTIONS.map((option) => (
          <button
            key={option.kind}
            className={`${styles.filterButton} ${selectedFilter === option.kind ? styles.filterButtonActive : ''}`}
            onClick={() => setSelectedFilter(option.kind)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>

      {filteredItems.length === 0 ? (
        <div className={styles.emptyState}>Không có giao dịch</div>
      ) : (
        <div className={styles.transactionsSection}>
          {filteredItems.map((item) => {
            const description = describeHistoryItem(item)
            const statusBadge = getHistoryStatusBadge(item.status)
            const isCancelling =
              cancellingItemKey === `${item.kind}-${item.id}`

            return (
              <div key={`${item.kind}-${item.id}`} className={styles.transactionItem}>
                <div className={styles.transactionTopRow}>
                  <div className={styles.transactionMeta}>
                    <div className={styles.transactionTitle}>{description.title}</div>
                    <div className={styles.transactionDate}>
                      {new Date(item.createdAt).toLocaleString('vi-VN')}
                    </div>
                  </div>
                  <div className={styles.transactionActions}>
                    {canCancelHistoryItem(item) ? (
                      <button
                        aria-label="Hủy giao dịch"
                        className={styles.cancelPendingButton}
                        disabled={isCancelling}
                        onClick={() => void handleCancel(item)}
                        type="button"
                      >
                        {isCancelling ? 'Đang hủy...' : 'Hủy'}
                      </button>
                    ) : null}
                    <div
                      className={`${styles.statusBadge} ${styles[`statusBadge${statusBadge.tone[0].toUpperCase()}${statusBadge.tone.slice(1)}`]}`}
                    >
                      {statusBadge.label}
                    </div>
                  </div>
                </div>
                <div className={styles.transactionAmount}>
                  {item.assetCode === 'VND'
                    ? `${formatVnd(item.amount)} ${item.assetCode}`
                    : `${formatUsdt(item.amount)} ${item.assetCode}`}
                </div>
                <div className={styles.transactionRows}>
                  {description.rows.map((row) => (
                    <div
                      key={`${item.kind}-${item.id}-${row.label}`}
                      className={styles.transactionRow}
                    >
                      <span className={styles.transactionRowLabel}>{row.label}</span>
                      <span className={styles.transactionRowValue}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <NotificationHistoryOverlay
        onClose={() => setShowNotifications(false)}
        open={showNotifications}
      />

      <BottomNav active="history" />
    </div>
  )
}
