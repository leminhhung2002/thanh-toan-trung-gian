import type { HistoryListItem } from './api'
import { formatUsdt, formatVnd } from '#/lib/utils/format'

type HistoryUiItem = HistoryListItem

export type HistoryStatusBadgeTone =
  | 'approved'
  | 'neutral'
  | 'pending'
  | 'rejected'

export type HistoryStatusBadge = {
  label: string
  tone: HistoryStatusBadgeTone
}

export type HistoryItemDescription = {
  rows: Array<{ label: string; value: string }>
  title: string
}

const DAY_IN_MS = 24 * 60 * 60 * 1000
const FINALIZED_VISIBILITY_WINDOW_MS = 3 * DAY_IN_MS
const PENDING_VISIBILITY_WINDOW_MS = 5 * DAY_IN_MS

export function getHistoryStatusBadge(status?: string): HistoryStatusBadge {
  if (status === 'pending') {
    return {
      label: 'Đang xử lý',
      tone: 'pending',
    }
  }

  if (status === 'approved') {
    return {
      label: 'Đã duyệt',
      tone: 'approved',
    }
  }

  if (status === 'rejected') {
    return {
      label: 'Từ chối',
      tone: 'rejected',
    }
  }

  if (status === 'completed') {
    return {
      label: 'Hoàn tất',
      tone: 'approved',
    }
  }

  if (status === 'cancelled') {
    return {
      label: 'Đã hủy',
      tone: 'neutral',
    }
  }

  if (status === 'reversed') {
    return {
      label: 'Đã khôi phục',
      tone: 'neutral',
    }
  }

  return {
    label: 'Đang xử lý',
    tone: 'neutral',
  }
}

export function filterVisibleHistoryItems<T extends HistoryUiItem>(
  items: T[],
  now = Date.now(),
) {
  return items.filter((item) => {
    const visibilityReferenceAt = getVisibilityReferenceAt(item)
    const createdAt = new Date(visibilityReferenceAt).getTime()

    if (!Number.isFinite(createdAt)) {
      return true
    }

    const ageMs = now - createdAt

    if (item.status === 'pending') {
      return ageMs <= PENDING_VISIBILITY_WINDOW_MS
    }

    if (
      item.status === 'approved' ||
      item.status === 'cancelled' ||
      item.status === 'reversed' ||
      item.status === 'rejected' ||
      item.status === 'completed'
    ) {
      return ageMs <= FINALIZED_VISIBILITY_WINDOW_MS
    }

    return true
  })
}

function getVisibilityReferenceAt(item: HistoryUiItem) {
  if (item.status === 'approved') {
    return item.approvedAt ?? item.createdAt
  }

  if (item.status === 'rejected') {
    return item.rejectedAt ?? item.createdAt
  }

  if (item.status === 'cancelled') {
    return item.cancelledAt ?? item.createdAt
  }

  if (item.status === 'reversed') {
    return item.reversedAt ?? item.createdAt
  }

  return item.createdAt
}

export function canCancelHistoryItem(item: HistoryUiItem) {
  return (
    item.status === 'pending'
    && (item.kind === 'deposit' || item.kind === 'withdrawal')
  )
}

export function describeHistoryItem(item: HistoryUiItem): HistoryItemDescription {
  if (item.kind === 'deposit') {
    const rows = [
      {
        label: 'Phương thức',
        value: formatMethod(item.method ?? item.destinationDetails?.method),
      },
    ]

    if (item.selectedBankAccount) {
      rows.push({
        label: 'Tài khoản nhận',
        value: `${item.selectedBankAccount.bankName} - ${item.selectedBankAccount.accountNumber}`,
      })
    }

    if (item.destinationRef) {
      rows.push({
        label: 'Nội dung',
        value: item.destinationRef,
      })
    }

    if (item.reviewNote) {
      rows.push({
        label: 'Ghi chú',
        value: item.reviewNote,
      })
    }

    return {
      rows,
      title: 'Nạp tiền',
    }
  }

  if (item.kind === 'withdrawal') {
    const rows = [
      {
        label: 'Phương thức',
        value: formatMethod(item.method ?? item.destinationDetails?.method),
      },
    ]

    if (item.feeAmount) {
      rows.push({
        label: 'Phí',
        value: formatAmount(item.feeAmount, item.assetCode),
      })
    }

    if (item.totalDebit) {
      rows.push({
        label: 'Tổng trừ',
        value: formatAmount(item.totalDebit, item.assetCode),
      })
    }

    const destinationDetails = describeDestinationDetails(item.destinationDetails)

    if (destinationDetails) {
      rows.push({
        label: 'Nhận tiền',
        value: destinationDetails,
      })
    }

    if (item.reviewNote) {
      rows.push({
        label: 'Ghi chú',
        value: item.reviewNote,
      })
    }

    return {
      rows,
      title: 'Rút tiền',
    }
  }

  return {
    rows: [
      {
        label: 'Đã trừ',
        value: formatAmount(
          item.totalDebit ?? item.requestedAmount ?? '0',
          item.fromAssetCode ?? 'VND',
        ),
      },
      ...(item.grossReceiveAmount
        ? [
            {
              label: 'Quy đổi trước phí',
              value: formatAmount(item.grossReceiveAmount, item.assetCode),
            },
          ]
        : []),
      ...(item.feeAmount
        ? [
            {
              label: 'Phí',
              value: formatAmount(
                item.feeAmount,
                item.feeAssetCode ?? item.assetCode,
              ),
            },
          ]
        : []),
      {
        label: 'Nhận',
        value: formatAmount(item.amount, item.assetCode),
      },
      {
        label: 'Tỷ giá áp dụng',
        value: item.rate ? `${formatVnd(item.rate)} VND / 1 USDT` : '--',
      },
    ],
    title: 'Đổi tiền',
  }
}

function formatAmount(amount: string, assetCode: string) {
  if (assetCode === 'VND') {
    return `${formatVnd(amount)} VND`
  }

  return `${formatUsdt(amount)} ${assetCode}`
}

function formatMethod(method?: string) {
  if (method === 'bank_transfer') {
    return 'Chuyển khoản ngân hàng'
  }

  if (method === 'bep20') {
    return 'BEP20-USDT'
  }

  if (method === 'trc20') {
    return 'TRC20-USDT'
  }

  return method?.toUpperCase() ?? 'Không rõ'
}

function describeDestinationDetails(
  destinationDetails: HistoryUiItem['destinationDetails'],
) {
  if (!destinationDetails) {
    return null
  }

  if (destinationDetails.method === 'bank_transfer') {
    const bankName =
      typeof destinationDetails.bankName === 'string'
        ? destinationDetails.bankName
        : 'Ngân hàng'
    const accountNumber =
      typeof destinationDetails.accountNumber === 'string'
        ? destinationDetails.accountNumber
        : ''

    return accountNumber ? `${bankName} - ${accountNumber}` : bankName
  }

  if (
    destinationDetails.method === 'bep20'
    || destinationDetails.method === 'trc20'
  ) {
    const network =
      typeof destinationDetails.network === 'string'
        ? destinationDetails.network
        : destinationDetails.method === 'trc20'
          ? 'TRC20'
          : 'BEP20'
    const walletAddress =
      typeof destinationDetails.walletAddress === 'string'
        ? destinationDetails.walletAddress
        : ''
    const shortAddress =
      walletAddress.length > 12
        ? walletAddress
        : walletAddress

    return shortAddress ? `${network} - ${shortAddress}` : network
  }

  return null
}
