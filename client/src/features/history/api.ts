import type {
  DepositRequest,
  ExchangeOrderSummary,
  SelectedDepositBankAccount,
  WalletLedger,
  WalletLedgerEntry,
  WalletSummary,
  WithdrawalDestinationDetails,
  WithdrawalRequest,
} from '#/lib/types'
import { exchangeApi } from '../exchange/api'
import { walletApi } from '../wallet/api'
import { formatUsdt, formatVnd } from '#/lib/utils/format'

export type HistoryListItem = {
  amount: string
  assetCode: string
  approvedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  destinationDetails?: WithdrawalDestinationDetails | null
  destinationRef?: string | null
  feeAmount?: string | null
  feeAssetCode?: string | null
  id: string
  kind: 'deposit' | 'exchange' | 'withdrawal'
  method?: string
  note?: string | null
  fromAssetCode?: string | null
  grossReceiveAmount?: string | null
  rate?: string | null
  requestedAmount?: string | null
  rejectedAt?: string | null
  reversedAt?: string | null
  reviewNote?: string | null
  roundingMode?: string | null
  selectedBankAccount?: SelectedDepositBankAccount | null
  status?: string
  totalDebit?: string | null
}

export type HistorySnapshot = {
  items: HistoryListItem[]
  totalDepositVnd: number
  totalWithdrawUsdt: number
  totalWithdrawVnd: number
  wallets: WalletSummary[]
}

export type NotificationHistoryItem = {
  createdAt: string
  id: string
  kind: 'deposit' | 'exchange' | 'withdrawal'
  primaryAmount: string
  primaryAmountSign: 'minus' | 'plus'
  primaryAssetCode: string
  referenceId: string
  secondaryText: string
  title: string
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function sortByNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function formatNotificationAmount(amount: string, assetCode: string) {
  if (assetCode === 'VND') {
    return `${formatVnd(amount)} ${assetCode}`
  }

  return `${formatUsdt(amount)} ${assetCode}`
}

function isAvailableCreditEntry(entry: WalletLedgerEntry) {
  return entry.bucket === 'available' && entry.direction === 'credit'
}

function isAvailableDebitEntry(entry: WalletLedgerEntry) {
  return entry.bucket === 'available' && entry.direction === 'debit'
}

function buildDepositNotification(
  entry: WalletLedgerEntry,
  deposit: DepositRequest | undefined,
): NotificationHistoryItem | null {
  if (!deposit || !isAvailableCreditEntry(entry)) {
    return null
  }

  return {
    createdAt: entry.createdAt,
    id: `deposit-${deposit.id}`,
    kind: 'deposit',
    primaryAmount: deposit.amount,
    primaryAmountSign: 'plus',
    primaryAssetCode: deposit.assetCode,
    referenceId: deposit.id,
    secondaryText: `Đã cộng vào ví ${deposit.assetCode}`,
    title: 'Nạp tiền',
  }
}

function buildWithdrawalNotification(
  entry: WalletLedgerEntry,
  withdrawal: WithdrawalRequest | undefined,
): NotificationHistoryItem | null {
  if (!withdrawal || !isAvailableDebitEntry(entry) || !withdrawal.totalDebit) {
    return null
  }

  return {
    createdAt: entry.createdAt,
    id: `withdrawal-${withdrawal.id}`,
    kind: 'withdrawal',
    primaryAmount: withdrawal.totalDebit,
    primaryAmountSign: 'minus',
    primaryAssetCode: withdrawal.assetCode,
    referenceId: withdrawal.id,
    secondaryText: `Đã giữ ${formatNotificationAmount(withdrawal.totalDebit, withdrawal.assetCode)}`,
    title: 'Rút tiền',
  }
}

function buildExchangeNotification(
  entry: WalletLedgerEntry,
  order: ExchangeOrderSummary | undefined,
): NotificationHistoryItem | null {
  if (!order || order.status !== 'completed' || !isAvailableCreditEntry(entry)) {
    return null
  }

  return {
    createdAt: entry.createdAt,
    id: `exchange-${order.id}`,
    kind: 'exchange',
    primaryAmount: order.toAmount,
    primaryAmountSign: 'plus',
    primaryAssetCode: order.toAssetCode,
    referenceId: order.id,
    secondaryText: `Đã trừ ${formatNotificationAmount(order.totalDebit, order.fromAssetCode)}`,
    title: 'Đổi tiền',
  }
}

function buildNotificationsFromLedger(input: {
  deposits: DepositRequest[]
  exchangeOrders: ExchangeOrderSummary[]
  ledgers: WalletLedger[]
  withdrawals: WithdrawalRequest[]
}) {
  const depositsById = new Map(input.deposits.map((item) => [item.id, item]))
  const exchangeOrdersById = new Map(
    input.exchangeOrders.map((item) => [item.id, item]),
  )
  const withdrawalsById = new Map(
    input.withdrawals.map((item) => [item.id, item]),
  )

  const notifications = input.ledgers.flatMap((ledger) =>
    ledger.entries.flatMap((entry) => {
      if (entry.referenceType === 'deposit_request') {
        const notification = buildDepositNotification(
          entry,
          depositsById.get(entry.referenceId),
        )

        return notification ? [notification] : []
      }

      if (entry.referenceType === 'withdrawal_request') {
        const notification = buildWithdrawalNotification(
          entry,
          withdrawalsById.get(entry.referenceId),
        )

        return notification ? [notification] : []
      }

      if (entry.referenceType === 'exchange_order') {
        const notification = buildExchangeNotification(
          entry,
          exchangeOrdersById.get(entry.referenceId),
        )

        return notification ? [notification] : []
      }

      return []
    }),
  )

  return sortByNewest(notifications)
}

function mapDeposit(item: DepositRequest): HistoryListItem {
  return {
    amount: item.amount,
    assetCode: item.assetCode,
    approvedAt: item.approvedAt,
    cancelledAt: item.cancelledAt,
    createdAt: item.createdAt,
    destinationRef: item.destinationRef,
    id: item.id,
    kind: 'deposit',
    method: item.method,
    note: item.note,
    rejectedAt: item.rejectedAt,
    reviewNote: item.reviewNote,
    selectedBankAccount: item.selectedBankAccount,
    status: item.status,
  }
}

function mapWithdrawal(item: WithdrawalRequest): HistoryListItem {
  return {
    amount: item.amount,
    assetCode: item.assetCode,
    approvedAt: item.approvedAt,
    cancelledAt: item.cancelledAt,
    createdAt: item.createdAt,
    destinationDetails: item.destinationDetails,
    feeAmount: item.feeAmount,
    id: item.id,
    kind: 'withdrawal',
    method: item.method,
    note: item.note,
    rejectedAt: item.rejectedAt,
    reviewNote: item.reviewNote,
    status: item.status,
    totalDebit: item.totalDebit,
  }
}

function mapExchange(item: ExchangeOrderSummary): HistoryListItem {
  return {
    amount: item.toAmount,
    assetCode: item.toAssetCode,
    createdAt: item.createdAt,
    feeAmount: item.feeAmount,
    feeAssetCode: item.feeAssetCode,
    fromAssetCode: item.fromAssetCode,
    grossReceiveAmount: item.grossReceiveAmount,
    id: item.id,
    kind: 'exchange',
    note:
      item.fromAssetCode === 'USDT'
        ? 'Quy đổi số dư nội bộ từ USDT sang VND.'
        : 'Quy đổi số dư nội bộ từ VND sang USDT.',
    rate: item.rate,
    requestedAmount: item.requestedAmount,
    reversedAt: item.reversedAt,
    roundingMode: item.roundingMode,
    status: item.status,
    totalDebit: item.totalDebit,
  }
}

export async function getHistorySnapshot(): Promise<HistorySnapshot> {
  const [wallets, deposits, exchangeOrders, withdrawals] = await Promise.all([
    walletApi.listWallets(),
    walletApi.listDeposits(),
    exchangeApi.listOrders(),
    walletApi.listWithdrawals(),
  ])

  return {
    items: sortByNewest([
      ...deposits.map(mapDeposit),
      ...withdrawals.map(mapWithdrawal),
      ...exchangeOrders.map(mapExchange),
    ]),
    totalDepositVnd: deposits
      .filter((item) => item.assetCode === 'VND' && item.status === 'approved')
      .reduce((sum, item) => sum + toNumber(item.amount), 0),
    totalWithdrawUsdt: withdrawals
      .filter((item) => item.assetCode === 'USDT' && item.status === 'approved')
      .reduce((sum, item) => sum + toNumber(item.totalDebit ?? item.amount), 0),
    totalWithdrawVnd: withdrawals
      .filter((item) => item.assetCode === 'VND' && item.status === 'approved')
      .reduce((sum, item) => sum + toNumber(item.totalDebit ?? item.amount), 0),
    wallets,
  }
}

export async function getHistoryNotifications(): Promise<NotificationHistoryItem[]> {
  const [vndLedger, usdtLedger, deposits, exchangeOrders, withdrawals] =
    await Promise.all([
      walletApi.getLedger('VND'),
      walletApi.getLedger('USDT'),
      walletApi.listDeposits(),
      exchangeApi.listOrders(),
      walletApi.listWithdrawals(),
    ])

  return buildNotificationsFromLedger({
    deposits,
    exchangeOrders,
    ledgers: [vndLedger, usdtLedger],
    withdrawals,
  })
}

export function cancelPendingDeposit(depositId: string) {
  return walletApi.cancelDeposit(depositId)
}

export function cancelPendingWithdrawal(withdrawalId: string) {
  return walletApi.cancelWithdrawal(withdrawalId)
}
