import { describe, expect, it } from 'vitest'
import type {
  AdminBankAccount,
  AdminDepositRequest,
  AdminExchangeOrder,
  AdminUserSummary,
  AdminWithdrawalRequest,
} from '#/lib/types'
import type { AdminStatusFilter } from './api'
import { buildAdminOverviewMetrics } from './overview'

function createDeposit(
  overrides: Partial<AdminDepositRequest> = {},
): AdminDepositRequest {
  return {
    amount: '0',
    assetCode: 'VND',
    createdAt: '2026-04-05T00:00:00.000Z',
    id: 'deposit-default',
    method: 'bank_transfer',
    status: 'pending',
    ...overrides,
  }
}

function createWithdrawal(
  overrides: Partial<AdminWithdrawalRequest> = {},
): AdminWithdrawalRequest {
  return {
    amount: '0',
    assetCode: 'VND',
    createdAt: '2026-04-05T00:00:00.000Z',
    id: 'withdrawal-default',
    method: 'bank_transfer',
    status: 'pending',
    ...overrides,
  }
}

function createBankAccount(
  overrides: Partial<AdminBankAccount> = {},
): AdminBankAccount {
  return {
    accountName: 'NGAN LUONG',
    accountNumber: '123456789',
    approvedTotal: '0',
    bankCode: '970436',
    bankName: 'Vietcombank',
    canDelete: true,
    createdAt: '2026-04-05T00:00:00.000Z',
    dailyLimit: '1000000',
    id: 'bank-default',
    isActive: true,
    liveReservationCount: 0,
    pendingDepositCount: 0,
    priority: 1,
    remainingToday: '1000000',
    reservedPendingReview: '0',
    reservedUnconfirmed: '0',
    updatedAt: '2026-04-05T00:00:00.000Z',
    usedToday: '0',
    ...overrides,
  }
}

function createExchangeOrder(
  overrides: Partial<AdminExchangeOrder> = {},
): AdminExchangeOrder {
  return {
    appliedMarkupVnd: 1000,
    createdAt: '2026-04-05T00:00:00.000Z',
    feeAmount: '0.04',
    feeAssetCode: 'USDT',
    feeBps: 100,
    feeProfitVnd: '0',
    fromAssetCode: 'VND',
    grossReceiveAmount: '3.84',
    id: 'exchange-default',
    markupProfitVnd: '0',
    rate: '26000',
    realtimeRateVnd: '25000',
    requestedAmount: '100000',
    status: 'completed',
    toAmount: '3.80',
    toAssetCode: 'USDT',
    totalDebit: '100000',
    userEmail: 'user@example.com',
    userId: 'user-default',
    ...overrides,
  }
}

function createUser(
  overrides: Partial<AdminUserSummary> = {},
): AdminUserSummary {
  return {
    balances: {
      usdt: { available: '0.00', pending: '0.00', total: '0.00' },
      vnd: { available: '0', pending: '0', total: '0' },
    },
    createdAt: '2026-04-05T00:00:00.000Z',
    email: 'user@example.com',
    id: 'user-default',
    phone: null,
    roles: ['user'],
    telegram: null,
    twoFactorEnabled: false,
    totals: {
      totalDepositUsdt: '0.00',
      totalDepositVnd: '0',
      totalWithdrawUsdt: '0.00',
      totalWithdrawVnd: '0',
    },
    ...overrides,
  }
}

describe('buildAdminOverviewMetrics', () => {
  it('aggregates overview stats by asset without mixing VND and USDT totals', () => {
    const metrics = buildAdminOverviewMetrics({
      bankAccounts: [
        createBankAccount({ bankName: 'Vietcombank', id: 'bank-1', isActive: true }),
        createBankAccount({ bankName: 'Vietcombank', id: 'bank-2', isActive: false }),
        createBankAccount({ bankName: 'ACB', id: 'bank-3', isActive: true }),
      ],
      deposits: [
        createDeposit({ amount: '100000', id: 'deposit-1', status: 'pending' }),
        createDeposit({ amount: '250000', id: 'deposit-2', status: 'approved' }),
        createDeposit({ amount: '50.5', assetCode: 'USDT', id: 'deposit-3', status: 'approved' }),
      ],
      exchangeOrders: [
        createExchangeOrder({
          feeAmount: '0.04',
          feeAssetCode: 'USDT',
          feeProfitVnd: '1000',
          grossReceiveAmount: '3.84',
          id: 'exchange-1',
          markupProfitVnd: '4000',
          toAmount: '3.80',
          totalDebit: '100000',
        }),
        createExchangeOrder({
          appliedMarkupVnd: 700,
          feeAmount: '1215',
          feeAssetCode: 'VND',
          feeBps: 50,
          feeProfitVnd: '1215',
          fromAssetCode: 'USDT',
          grossReceiveAmount: '243000',
          id: 'exchange-2',
          markupProfitVnd: '7000',
          rate: '24300',
          requestedAmount: '10.00',
          toAmount: '241785',
          toAssetCode: 'VND',
          totalDebit: '10.00',
        }),
      ],
      statusFilter: 'all',
      users: [
        createUser({ id: 'user-1', roles: ['user'] }),
        createUser({ id: 'user-2', roles: ['user', 'admin'] }),
        createUser({ id: 'user-3', roles: ['user', 'admin', 'super_admin'] }),
      ],
      withdrawals: [
        createWithdrawal({ amount: '200000', id: 'withdrawal-1', status: 'pending' }),
        createWithdrawal({
          amount: '300000',
          feeAmount: '30000',
          feeProfitVnd: '30000',
          id: 'withdrawal-2',
          status: 'approved',
        }),
        createWithdrawal({
          amount: '12.25',
          assetCode: 'USDT',
          feeAmount: '0.5',
          feeProfitVnd: '12500',
          id: 'withdrawal-3',
          method: 'bep20',
          status: 'approved',
        }),
      ],
    })

    expect(metrics.filtered.vnd.depositCount).toBe(2)
    expect(metrics.filtered.vnd.withdrawalCount).toBe(2)
    expect(metrics.filtered.vnd.depositAmountTotal).toBe(350000)
    expect(metrics.filtered.vnd.withdrawalAmountTotal).toBe(500000)
    expect(metrics.filtered.vnd.transactionCount).toBe(4)
    expect(metrics.filtered.vnd.netAmount).toBe(-150000)
    expect(metrics.filtered.usdt.depositCount).toBe(1)
    expect(metrics.filtered.usdt.withdrawalCount).toBe(1)
    expect(metrics.filtered.usdt.depositAmountTotal).toBe(50.5)
    expect(metrics.filtered.usdt.withdrawalAmountTotal).toBe(12.25)
    expect(metrics.filtered.usdt.transactionCount).toBe(2)
    expect(metrics.filtered.usdt.netAmount).toBe(38.25)
    expect(metrics.pending.vnd.depositCount).toBe(1)
    expect(metrics.pending.vnd.withdrawalCount).toBe(1)
    expect(metrics.pending.vnd.depositAmountTotal).toBe(100000)
    expect(metrics.pending.vnd.withdrawalAmountTotal).toBe(200000)
    expect(metrics.pending.vnd.transactionCount).toBe(2)
    expect(metrics.pending.vnd.netAmount).toBe(-100000)
    expect(metrics.pending.usdt.depositCount).toBe(0)
    expect(metrics.pending.usdt.withdrawalCount).toBe(0)
    expect(metrics.pending.usdt.depositAmountTotal).toBe(0)
    expect(metrics.pending.usdt.withdrawalAmountTotal).toBe(0)
    expect(metrics.pending.usdt.transactionCount).toBe(0)
    expect(metrics.pending.usdt.netAmount).toBe(0)
    expect(metrics.transactions.exchangeCount).toBe(2)
    expect(metrics.profit.feeNative.vnd).toBe(31215)
    expect(metrics.profit.feeNative.usdt).toBe(0.54)
    expect(metrics.profit.feeVnd).toBe(44715)
    expect(metrics.profit.markupVnd).toBe(11000)
    expect(metrics.profit.totalVnd).toBe(55715)
    expect(metrics.banks.totalCount).toBe(3)
    expect(metrics.banks.activeCount).toBe(2)
    expect(metrics.banks.pausedCount).toBe(1)
    expect(metrics.banks.uniqueBankCount).toBe(2)
    expect(metrics.users.totalCount).toBe(3)
    expect(metrics.users.adminCount).toBe(2)
    expect(metrics.users.superAdminCount).toBe(1)
    expect(metrics.users.standardUserCount).toBe(1)
  })

  it('applies the selected status filter to per-asset totals while keeping pending counters global', () => {
    const metrics = buildAdminOverviewMetrics({
      bankAccounts: [],
      deposits: [
        createDeposit({ amount: '100000', id: 'deposit-1', status: 'pending' }),
        createDeposit({ amount: '250000', id: 'deposit-2', status: 'approved' }),
        createDeposit({
          amount: '25',
          assetCode: 'USDT',
          id: 'deposit-3',
          status: 'approved',
        }),
      ],
      exchangeOrders: [
        createExchangeOrder({
          feeAmount: '500',
          feeProfitVnd: '500',
          id: 'exchange-1',
          markupProfitVnd: '1200',
        }),
      ],
      statusFilter: 'approved' satisfies AdminStatusFilter,
      users: [],
      withdrawals: [
        createWithdrawal({ amount: '200000', id: 'withdrawal-1', status: 'pending' }),
        createWithdrawal({
          amount: '300000',
          feeAmount: '30000',
          feeProfitVnd: '30000',
          id: 'withdrawal-2',
          status: 'approved',
        }),
        createWithdrawal({
          amount: '10',
          assetCode: 'USDT',
          feeAmount: '0.25',
          feeProfitVnd: '6250',
          id: 'withdrawal-3',
          method: 'trc20',
          status: 'approved',
        }),
      ],
    })

    expect(metrics.filtered.vnd.depositCount).toBe(1)
    expect(metrics.filtered.vnd.withdrawalCount).toBe(1)
    expect(metrics.filtered.vnd.depositAmountTotal).toBe(250000)
    expect(metrics.filtered.vnd.withdrawalAmountTotal).toBe(300000)
    expect(metrics.filtered.vnd.transactionCount).toBe(2)
    expect(metrics.filtered.vnd.netAmount).toBe(-50000)
    expect(metrics.filtered.usdt.depositCount).toBe(1)
    expect(metrics.filtered.usdt.withdrawalCount).toBe(1)
    expect(metrics.filtered.usdt.depositAmountTotal).toBe(25)
    expect(metrics.filtered.usdt.withdrawalAmountTotal).toBe(10)
    expect(metrics.filtered.usdt.transactionCount).toBe(2)
    expect(metrics.filtered.usdt.netAmount).toBe(15)
    expect(metrics.pending.vnd.depositCount).toBe(1)
    expect(metrics.pending.vnd.withdrawalCount).toBe(1)
    expect(metrics.pending.vnd.depositAmountTotal).toBe(100000)
    expect(metrics.pending.vnd.withdrawalAmountTotal).toBe(200000)
    expect(metrics.pending.usdt.depositCount).toBe(0)
    expect(metrics.pending.usdt.withdrawalCount).toBe(0)
    expect(metrics.transactions.exchangeCount).toBe(1)
    expect(metrics.profit.feeVnd).toBe(36750)
    expect(metrics.profit.markupVnd).toBe(1200)
    expect(metrics.profit.totalVnd).toBe(37950)
  })

  it('drops exchange volume from the status-filtered transaction count when the selected status cannot match completed exchanges', () => {
    const metrics = buildAdminOverviewMetrics({
      bankAccounts: [],
      deposits: [
        createDeposit({ amount: '100000', id: 'deposit-1', status: 'pending' }),
      ],
      exchangeOrders: [
        createExchangeOrder({
          feeAmount: '500',
          feeProfitVnd: '500',
          id: 'exchange-1',
          markupProfitVnd: '1200',
        }),
      ],
      statusFilter: 'pending',
      users: [],
      withdrawals: [
        createWithdrawal({ amount: '200000', id: 'withdrawal-1', status: 'pending' }),
      ],
    })

    expect(metrics.filtered.vnd.depositCount).toBe(1)
    expect(metrics.filtered.vnd.withdrawalCount).toBe(1)
    expect(metrics.transactions.exchangeCount).toBe(0)
    expect(metrics.profit.feeVnd).toBe(500)
    expect(metrics.profit.markupVnd).toBe(1200)
    expect(metrics.profit.totalVnd).toBe(1700)
  })

  it('removes reversed exchange orders from profit and exchange totals while keeping the audit row intact elsewhere', () => {
    const metrics = buildAdminOverviewMetrics({
      bankAccounts: [],
      deposits: [],
      exchangeOrders: [
        createExchangeOrder({
          feeAmount: '0.04',
          feeAssetCode: 'USDT',
          feeProfitVnd: '1000',
          id: 'exchange-completed',
          markupProfitVnd: '4000',
          status: 'completed',
        }),
        createExchangeOrder({
          appliedMarkupVnd: 700,
          feeAmount: '1215',
          feeAssetCode: 'VND',
          feeBps: 50,
          feeProfitVnd: '1215',
          fromAssetCode: 'USDT',
          id: 'exchange-reversed',
          markupProfitVnd: '7000',
          rate: '24300',
          requestedAmount: '10.00',
          status: 'reversed' as AdminExchangeOrder['status'],
          toAmount: '241785',
          toAssetCode: 'VND',
          totalDebit: '10.00',
        }),
      ],
      statusFilter: 'all',
      users: [],
      withdrawals: [],
    })

    expect(metrics.transactions.exchangeCount).toBe(1)
    expect(metrics.profit.feeNative.vnd).toBe(0)
    expect(metrics.profit.feeNative.usdt).toBe(0.04)
    expect(metrics.profit.feeVnd).toBe(1000)
    expect(metrics.profit.markupVnd).toBe(4000)
    expect(metrics.profit.totalVnd).toBe(5000)
  })

  it('aggregates overview metrics from records that have already been range-filtered', () => {
    const metrics = buildAdminOverviewMetrics({
      bankAccounts: [],
      deposits: [
        createDeposit({
          amount: '100000',
          createdAt: '2026-04-06T03:00:00.000Z',
          id: 'deposit-1',
          status: 'pending',
        }),
        createDeposit({
          amount: '11.5',
          assetCode: 'USDT',
          createdAt: '2026-04-06T04:00:00.000Z',
          id: 'deposit-3',
          status: 'approved',
        }),
      ],
      exchangeOrders: [
        createExchangeOrder({
          createdAt: '2026-04-06T06:00:00.000Z',
          feeAmount: '500',
          feeProfitVnd: '500',
          id: 'exchange-1',
          markupProfitVnd: '1200',
        }),
      ],
      statusFilter: 'all',
      users: [],
      withdrawals: [
        createWithdrawal({
          amount: '200000',
          createdAt: '2026-04-06T08:00:00.000Z',
          feeAmount: '20000',
          feeProfitVnd: '20000',
          id: 'withdrawal-1',
          status: 'approved',
        }),
        createWithdrawal({
          amount: '4.25',
          assetCode: 'USDT',
          createdAt: '2026-04-06T07:00:00.000Z',
          feeAmount: '0.1',
          feeProfitVnd: '2500',
          id: 'withdrawal-3',
          method: 'bep20',
          status: 'pending',
        }),
      ],
    })

    expect(metrics.filtered.vnd.depositCount).toBe(1)
    expect(metrics.filtered.vnd.depositAmountTotal).toBe(100000)
    expect(metrics.filtered.vnd.withdrawalCount).toBe(1)
    expect(metrics.filtered.vnd.withdrawalAmountTotal).toBe(200000)
    expect(metrics.filtered.usdt.depositCount).toBe(1)
    expect(metrics.filtered.usdt.depositAmountTotal).toBe(11.5)
    expect(metrics.filtered.usdt.withdrawalCount).toBe(1)
    expect(metrics.filtered.usdt.withdrawalAmountTotal).toBe(4.25)
    expect(metrics.pending.vnd.depositCount).toBe(1)
    expect(metrics.pending.vnd.withdrawalCount).toBe(0)
    expect(metrics.pending.usdt.depositCount).toBe(0)
    expect(metrics.pending.usdt.withdrawalCount).toBe(1)
    expect(metrics.transactions.exchangeCount).toBe(1)
    expect(metrics.profit.feeVnd).toBe(20500)
    expect(metrics.profit.markupVnd).toBe(1200)
    expect(metrics.profit.totalVnd).toBe(21700)
  })
})
