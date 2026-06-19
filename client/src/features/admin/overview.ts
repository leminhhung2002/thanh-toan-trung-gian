import type {
  AdminBankAccount,
  AdminDepositRequest,
  AdminExchangeOrder,
  AdminUserSummary,
  AdminWithdrawalRequest,
} from '#/lib/types'
import type { AdminStatusFilter } from './api'

type AdminOverviewMetricsInput = {
  bankAccounts: AdminBankAccount[]
  deposits: AdminDepositRequest[]
  exchangeOrders: AdminExchangeOrder[]
  statusFilter: AdminStatusFilter
  users: AdminUserSummary[]
  withdrawals: AdminWithdrawalRequest[]
}

type AssetTransactionSummary = {
  depositAmountTotal: number
  depositCount: number
  netAmount: number
  transactionCount: number
  withdrawalAmountTotal: number
  withdrawalCount: number
}

export type AdminOverviewMetrics = {
  banks: {
    activeCount: number
    pausedCount: number
    totalCount: number
    uniqueBankCount: number
  }
  filtered: {
    usdt: AssetTransactionSummary
    vnd: AssetTransactionSummary
  }
  profit: {
    feeNative: {
      usdt: number
      vnd: number
    }
    feeVnd: number
    markupVnd: number
    totalVnd: number
  }
  pending: {
    usdt: AssetTransactionSummary
    vnd: AssetTransactionSummary
  }
  transactions: {
    exchangeCount: number
  }
  users: {
    adminCount: number
    standardUserCount: number
    superAdminCount: number
    totalCount: number
  }
}

function toNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function filterByStatus<T extends { status?: string }>(
  items: T[],
  statusFilter: AdminStatusFilter,
) {
  if (statusFilter === 'all') {
    return items
  }

  return items.filter((item) => item.status === statusFilter)
}

function filterByAssetCode<T extends { assetCode: string }>(
  items: T[],
  assetCode: 'VND' | 'USDT',
) {
  return items.filter((item) => item.assetCode.toUpperCase() === assetCode)
}

function filterExchangeOrdersByAssetCode(
  items: AdminExchangeOrder[],
  assetCode: 'VND' | 'USDT',
) {
  return items.filter(
    (item) => (item.feeAssetCode ?? item.toAssetCode).toUpperCase() === assetCode,
  )
}

function filterExchangeOrdersByStatus(
  items: AdminExchangeOrder[],
  statusFilter: AdminStatusFilter,
) {
  if (statusFilter === 'all' || statusFilter === 'approved') {
    return items.filter((item) => item.status === 'completed')
  }

  return []
}

function buildTransactionSummary<
  T extends {
    amount: string
  },
>(deposits: T[], withdrawals: T[]): AssetTransactionSummary {
  const depositAmountTotal = deposits.reduce((sum, item) => sum + toNumber(item.amount), 0)
  const withdrawalAmountTotal = withdrawals.reduce(
    (sum, item) => sum + toNumber(item.amount),
    0,
  )

  return {
    depositAmountTotal,
    depositCount: deposits.length,
    netAmount: depositAmountTotal - withdrawalAmountTotal,
    transactionCount: deposits.length + withdrawals.length,
    withdrawalAmountTotal,
    withdrawalCount: withdrawals.length,
  }
}

export function buildAdminOverviewMetrics({
  bankAccounts,
  deposits,
  exchangeOrders,
  statusFilter,
  users,
  withdrawals,
}: AdminOverviewMetricsInput): AdminOverviewMetrics {
  const filteredExchangeOrders = filterExchangeOrdersByStatus(
    exchangeOrders,
    statusFilter,
  )
  const completedExchangeOrders = exchangeOrders.filter(
    (item) => item.status === 'completed',
  )
  const filteredDeposits = filterByStatus(deposits, statusFilter)
  const filteredWithdrawals = filterByStatus(withdrawals, statusFilter)
  const pendingDeposits = deposits.filter((item) => item.status === 'pending')
  const pendingWithdrawals = withdrawals.filter((item) => item.status === 'pending')
  const approvedWithdrawals = withdrawals.filter((item) => item.status === 'approved')
  const uniqueBankNames = new Set(
    bankAccounts
      .map((item) => item.bankName.trim())
      .filter((value) => value.length > 0),
  )
  const approvedVndWithdrawals = filterByAssetCode(approvedWithdrawals, 'VND')
  const approvedUsdtWithdrawals = filterByAssetCode(approvedWithdrawals, 'USDT')
  const exchangeOrdersFromVnd = filterExchangeOrdersByAssetCode(
    completedExchangeOrders,
    'VND',
  )
  const exchangeOrdersFromUsdt = filterExchangeOrdersByAssetCode(
    completedExchangeOrders,
    'USDT',
  )
  const feeNativeVnd =
    approvedVndWithdrawals.reduce(
      (sum, item) => sum + toNumber(item.feeAmount ?? '0'),
      0,
    ) +
    exchangeOrdersFromVnd.reduce(
      (sum, item) => sum + toNumber(item.feeAmount),
      0,
    )
  const feeNativeUsdt =
    approvedUsdtWithdrawals.reduce(
      (sum, item) => sum + toNumber(item.feeAmount ?? '0'),
      0,
    ) +
    exchangeOrdersFromUsdt.reduce(
      (sum, item) => sum + toNumber(item.feeAmount),
      0,
    )
  const feeVnd =
    approvedWithdrawals.reduce(
      (sum, item) => sum + toNumber(item.feeProfitVnd ?? '0'),
      0,
    ) +
    completedExchangeOrders.reduce(
      (sum, item) => sum + toNumber(item.feeProfitVnd),
      0,
    )
  const markupVnd = completedExchangeOrders.reduce(
    (sum, item) => sum + toNumber(item.markupProfitVnd),
    0,
  )

  return {
    banks: {
      activeCount: bankAccounts.filter((item) => item.isActive).length,
      pausedCount: bankAccounts.filter((item) => !item.isActive).length,
      totalCount: bankAccounts.length,
      uniqueBankCount: uniqueBankNames.size,
    },
    filtered: {
      usdt: buildTransactionSummary(
        filterByAssetCode(filteredDeposits, 'USDT'),
        filterByAssetCode(filteredWithdrawals, 'USDT'),
      ),
      vnd: buildTransactionSummary(
        filterByAssetCode(filteredDeposits, 'VND'),
        filterByAssetCode(filteredWithdrawals, 'VND'),
      ),
    },
    profit: {
      feeNative: {
        usdt: feeNativeUsdt,
        vnd: feeNativeVnd,
      },
      feeVnd,
      markupVnd,
      totalVnd: feeVnd + markupVnd,
    },
    pending: {
      usdt: buildTransactionSummary(
        filterByAssetCode(pendingDeposits, 'USDT'),
        filterByAssetCode(pendingWithdrawals, 'USDT'),
      ),
      vnd: buildTransactionSummary(
        filterByAssetCode(pendingDeposits, 'VND'),
        filterByAssetCode(pendingWithdrawals, 'VND'),
      ),
    },
    transactions: {
      exchangeCount: filteredExchangeOrders.length,
    },
    users: {
      adminCount: users.filter((item) => item.roles.includes('admin')).length,
      standardUserCount: users.filter(
        (item) =>
          item.roles.includes('user') &&
          !item.roles.includes('admin') &&
          !item.roles.includes('super_admin'),
      ).length,
      superAdminCount: users.filter((item) => item.roles.includes('super_admin'))
        .length,
      totalCount: users.length,
    },
  }
}
