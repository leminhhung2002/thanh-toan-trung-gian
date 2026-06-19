import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getLedger: vi.fn(),
  listExchangeOrders: vi.fn(),
  listDeposits: vi.fn(),
  listWallets: vi.fn(),
  listWithdrawals: vi.fn(),
}))

vi.mock('../wallet/api', () => ({
  walletApi: {
    getLedger: mocks.getLedger,
    listDeposits: mocks.listDeposits,
    listWallets: mocks.listWallets,
    listWithdrawals: mocks.listWithdrawals,
  },
}))

vi.mock('../exchange/api', () => ({
  exchangeApi: {
    listOrders: mocks.listExchangeOrders,
  },
}))

const { getHistoryNotifications, getHistorySnapshot } = await import('./api')

describe('history api', () => {
  beforeEach(() => {
    mocks.getLedger.mockReset()
    mocks.listExchangeOrders.mockReset()
    mocks.listDeposits.mockReset()
    mocks.listWallets.mockReset()
    mocks.listWithdrawals.mockReset()
  })

  it('builds history from structured exchange orders in both directions and sums withdrawals by total debit', async () => {
    mocks.listWallets.mockResolvedValue([
      {
        assetCode: 'VND',
        assetName: 'Vietnamese Dong',
        balances: { available: '0', pending: '0', total: '0' },
        walletId: 'wallet-vnd',
      },
      {
        assetCode: 'USDT',
        assetName: 'Tether USD',
        balances: { available: '0.000000', pending: '0.000000', total: '0.000000' },
        walletId: 'wallet-usdt',
      },
    ])
    mocks.listDeposits.mockResolvedValue([])
    mocks.listWithdrawals.mockResolvedValue([
      {
        amount: '100000',
        assetCode: 'VND',
        createdAt: '2026-04-03T00:00:00.000Z',
        feeAmount: '10000',
        id: 'withdrawal-1',
        method: 'bank_transfer',
        status: 'approved',
        totalDebit: '110000',
      },
      {
        amount: '50000',
        assetCode: 'VND',
        cancelledAt: '2026-04-03T01:00:00.000Z',
        createdAt: '2026-04-03T00:30:00.000Z',
        feeAmount: '5000',
        id: 'withdrawal-cancelled',
        method: 'bank_transfer',
        status: 'cancelled',
        totalDebit: '55000',
      },
    ])
    mocks.listExchangeOrders.mockResolvedValue([
      {
        createdAt: '2026-04-04T00:00:00.000Z',
        feeAmount: '0.04',
        feeAssetCode: 'USDT',
        fromAssetCode: 'VND',
        grossReceiveAmount: '3.04',
        id: 'exchange-1',
        rate: '26000',
        requestedAmount: '100000',
        roundingMode: 'floor_integer',
        status: 'completed',
        toAmount: '3.00',
        toAssetCode: 'USDT',
        totalDebit: '100000',
      },
      {
        createdAt: '2026-04-03T12:00:00.000Z',
        feeAmount: '1215',
        feeAssetCode: 'VND',
        fromAssetCode: 'USDT',
        grossReceiveAmount: '243000',
        id: 'exchange-reversed',
        rate: '24300',
        requestedAmount: '10.00',
        reversedAt: '2026-04-03T12:30:00.000Z',
        roundingMode: 'floor_asset_precision',
        status: 'reversed',
        toAmount: '241785',
        toAssetCode: 'VND',
        totalDebit: '10.00',
      },
      {
        createdAt: '2026-04-02T00:00:00.000Z',
        feeAmount: '1215',
        feeAssetCode: 'VND',
        fromAssetCode: 'USDT',
        grossReceiveAmount: '243000',
        id: 'exchange-2',
        rate: '24300',
        requestedAmount: '10.00',
        roundingMode: 'floor_asset_precision',
        status: 'completed',
        toAmount: '241785',
        toAssetCode: 'VND',
        totalDebit: '10.00',
      },
    ])

    const snapshot = await getHistorySnapshot()

    expect(snapshot.totalWithdrawVnd).toBe(110000)
    expect(snapshot.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          cancelledAt: '2026-04-03T01:00:00.000Z',
          id: 'withdrawal-cancelled',
          kind: 'withdrawal',
          status: 'cancelled',
          totalDebit: '55000',
        }),
        expect.objectContaining({
          amount: '3.00',
          assetCode: 'USDT',
          feeAmount: '0.04',
          feeAssetCode: 'USDT',
          fromAssetCode: 'VND',
          grossReceiveAmount: '3.04',
          id: 'exchange-1',
          kind: 'exchange',
          requestedAmount: '100000',
          roundingMode: 'floor_integer',
          status: 'completed',
          totalDebit: '100000',
        }),
        expect.objectContaining({
          amount: '241785',
          assetCode: 'VND',
          feeAmount: '1215',
          feeAssetCode: 'VND',
          fromAssetCode: 'USDT',
          grossReceiveAmount: '243000',
          id: 'exchange-2',
          kind: 'exchange',
          requestedAmount: '10.00',
          roundingMode: 'floor_asset_precision',
          status: 'completed',
          totalDebit: '10.00',
        }),
        expect.objectContaining({
          amount: '241785',
          assetCode: 'VND',
          feeAmount: '1215',
          feeAssetCode: 'VND',
          fromAssetCode: 'USDT',
          grossReceiveAmount: '243000',
          id: 'exchange-reversed',
          kind: 'exchange',
          requestedAmount: '10.00',
          reversedAt: '2026-04-03T12:30:00.000Z',
          status: 'reversed',
          totalDebit: '10.00',
        }),
      ]),
    )
  })

  it('builds compact notification items from ledgers and related financial records', async () => {
    mocks.listDeposits.mockResolvedValue([
      {
        amount: '10000',
        approvedAt: '2026-04-04T10:00:00.000Z',
        assetCode: 'VND',
        createdAt: '2026-04-04T09:00:00.000Z',
        id: 'deposit-1',
        method: 'bank_transfer',
        status: 'approved',
      },
    ])
    mocks.listWithdrawals.mockResolvedValue([
      {
        amount: '10000',
        assetCode: 'VND',
        createdAt: '2026-04-05T09:00:00.000Z',
        feeAmount: '1000',
        id: 'withdrawal-1',
        method: 'bank_transfer',
        status: 'pending',
        totalDebit: '11000',
      },
    ])
    mocks.listExchangeOrders.mockResolvedValue([
      {
        createdAt: '2026-04-06T09:00:00.000Z',
        feeAmount: '0.04',
        feeAssetCode: 'USDT',
        fromAssetCode: 'VND',
        grossReceiveAmount: '4.04',
        id: 'exchange-1',
        rate: '25000',
        requestedAmount: '100000',
        roundingMode: 'floor_asset_precision',
        status: 'completed',
        toAmount: '4.00',
        toAssetCode: 'USDT',
        totalDebit: '100000',
      },
      {
        createdAt: '2026-04-03T09:00:00.000Z',
        feeAmount: '1225',
        feeAssetCode: 'VND',
        fromAssetCode: 'USDT',
        grossReceiveAmount: '245000',
        id: 'exchange-2',
        rate: '24500',
        requestedAmount: '10.00',
        roundingMode: 'floor_asset_precision',
        status: 'completed',
        toAmount: '243775',
        toAssetCode: 'VND',
        totalDebit: '10.00',
      },
    ])
    mocks.getLedger.mockImplementation(async (assetCode: string) => {
      if (assetCode === 'VND') {
        return {
          entries: [
            {
              amount: '10000',
              amountMinor: '10000',
              bucket: 'available',
              createdAt: '2026-04-04T10:00:00.000Z',
              direction: 'credit',
              id: 'ledger-deposit-available',
              note: null,
              referenceId: 'deposit-1',
              referenceType: 'deposit_request',
            },
            {
              amount: '10000',
              amountMinor: '10000',
              bucket: 'total',
              createdAt: '2026-04-04T10:00:00.000Z',
              direction: 'credit',
              id: 'ledger-deposit-total',
              note: null,
              referenceId: 'deposit-1',
              referenceType: 'deposit_request',
            },
            {
              amount: '11000',
              amountMinor: '11000',
              bucket: 'available',
              createdAt: '2026-04-05T09:00:00.000Z',
              direction: 'debit',
              id: 'ledger-withdrawal-available',
              note: null,
              referenceId: 'withdrawal-1',
              referenceType: 'withdrawal_request',
            },
            {
              amount: '11000',
              amountMinor: '11000',
              bucket: 'pending',
              createdAt: '2026-04-05T09:00:00.000Z',
              direction: 'credit',
              id: 'ledger-withdrawal-pending',
              note: null,
              referenceId: 'withdrawal-1',
              referenceType: 'withdrawal_request',
            },
            {
              amount: '100000',
              amountMinor: '100000',
              bucket: 'available',
              createdAt: '2026-04-06T09:00:00.000Z',
              direction: 'debit',
              id: 'ledger-exchange-vnd-available',
              note: 'Đổi tiền - tổng trừ',
              referenceId: 'exchange-1',
              referenceType: 'exchange_order',
            },
            {
              amount: '100000',
              amountMinor: '100000',
              bucket: 'total',
              createdAt: '2026-04-06T09:00:00.000Z',
              direction: 'debit',
              id: 'ledger-exchange-vnd-total',
              note: 'Đổi tiền - tổng trừ',
              referenceId: 'exchange-1',
              referenceType: 'exchange_order',
            },
            {
              amount: '25000',
              amountMinor: '25000',
              bucket: 'available',
              createdAt: '2026-04-01T09:00:00.000Z',
              direction: 'credit',
              id: 'ledger-admin-adjust',
              note: 'Admin cộng tiền',
              referenceId: 'adjust-1',
              referenceType: 'admin_adjust',
            },
          ],
          wallet: {
            assetCode: 'VND',
            balances: {
              available: '0',
              pending: '0',
              total: '0',
            },
          },
        }
      }

      return {
        entries: [
          {
            amount: '4.00',
            amountMinor: '400',
            bucket: 'available',
            createdAt: '2026-04-06T09:00:00.000Z',
            direction: 'credit',
            id: 'ledger-exchange-usdt-available',
            note: 'Đổi tiền - tiền nhận',
            referenceId: 'exchange-1',
            referenceType: 'exchange_order',
          },
          {
            amount: '4.00',
            amountMinor: '400',
            bucket: 'total',
            createdAt: '2026-04-06T09:00:00.000Z',
            direction: 'credit',
            id: 'ledger-exchange-usdt-total',
            note: 'Đổi tiền - tiền nhận',
            referenceId: 'exchange-1',
            referenceType: 'exchange_order',
          },
          {
            amount: '243775',
            amountMinor: '243775',
            bucket: 'available',
            createdAt: '2026-04-03T09:00:00.000Z',
            direction: 'credit',
            id: 'ledger-exchange-vnd-credit',
            note: 'Đổi tiền - tiền nhận',
            referenceId: 'exchange-2',
            referenceType: 'exchange_order',
          },
        ],
        wallet: {
          assetCode: 'USDT',
          balances: {
            available: '0',
            pending: '0',
            total: '0',
          },
        },
      }
    })

    await expect(getHistoryNotifications()).resolves.toEqual([
      {
        createdAt: '2026-04-06T09:00:00.000Z',
        id: 'exchange-exchange-1',
        kind: 'exchange',
        primaryAmount: '4.00',
        primaryAmountSign: 'plus',
        primaryAssetCode: 'USDT',
        referenceId: 'exchange-1',
        secondaryText: 'Đã trừ 100.000 VND',
        title: 'Đổi tiền',
      },
      {
        createdAt: '2026-04-05T09:00:00.000Z',
        id: 'withdrawal-withdrawal-1',
        kind: 'withdrawal',
        primaryAmount: '11000',
        primaryAmountSign: 'minus',
        primaryAssetCode: 'VND',
        referenceId: 'withdrawal-1',
        secondaryText: 'Đã giữ 11.000 VND',
        title: 'Rút tiền',
      },
      {
        createdAt: '2026-04-04T10:00:00.000Z',
        id: 'deposit-deposit-1',
        kind: 'deposit',
        primaryAmount: '10000',
        primaryAmountSign: 'plus',
        primaryAssetCode: 'VND',
        referenceId: 'deposit-1',
        secondaryText: 'Đã cộng vào ví VND',
        title: 'Nạp tiền',
      },
      {
        createdAt: '2026-04-03T09:00:00.000Z',
        id: 'exchange-exchange-2',
        kind: 'exchange',
        primaryAmount: '243775',
        primaryAmountSign: 'plus',
        primaryAssetCode: 'VND',
        referenceId: 'exchange-2',
        secondaryText: 'Đã trừ 10.00 USDT',
        title: 'Đổi tiền',
      },
    ])
  })
})
