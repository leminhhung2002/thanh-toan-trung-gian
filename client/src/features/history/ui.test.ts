import { describe, expect, it } from 'vitest'

import {
  describeHistoryItem,
  filterVisibleHistoryItems,
  getHistoryStatusBadge,
} from './ui'

describe('getHistoryStatusBadge', () => {
  it('maps history statuses into badge labels and tones', () => {
    expect(getHistoryStatusBadge('pending')).toEqual({
      label: 'Đang xử lý',
      tone: 'pending',
    })
    expect(getHistoryStatusBadge('approved')).toEqual({
      label: 'Đã duyệt',
      tone: 'approved',
    })
    expect(getHistoryStatusBadge('rejected')).toEqual({
      label: 'Từ chối',
      tone: 'rejected',
    })
    expect(getHistoryStatusBadge('completed')).toEqual({
      label: 'Hoàn tất',
      tone: 'approved',
    })
    expect(getHistoryStatusBadge('cancelled')).toEqual({
      label: 'Đã hủy',
      tone: 'neutral',
    })
    expect(getHistoryStatusBadge('reversed')).toEqual({
      label: 'Đã khôi phục',
      tone: 'neutral',
    })
  })
})

describe('describeHistoryItem', () => {
  it('builds short rows for deposit, withdrawal, and exchange cards', () => {
    expect(
      describeHistoryItem({
        amount: '100000',
        assetCode: 'VND',
        createdAt: '2026-01-01T00:00:00.000Z',
        destinationRef: 'CHUYENTIENA1B',
        id: 'dep-1',
        kind: 'deposit',
        method: 'bank_transfer',
        status: 'approved',
      }),
    ).toEqual({
      rows: [
        { label: 'Phương thức', value: 'Chuyển khoản ngân hàng' },
        { label: 'Nội dung', value: 'CHUYENTIENA1B' },
      ],
      title: 'Nạp tiền',
    })

    expect(
      describeHistoryItem({
        amount: '25000',
        assetCode: 'VND',
        createdAt: '2026-01-01T00:00:00.000Z',
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
        feeAmount: '2500',
        id: 'wd-1',
        kind: 'withdrawal',
        status: 'pending',
        totalDebit: '27500',
      }),
    ).toEqual({
      rows: [
        { label: 'Phương thức', value: 'Chuyển khoản ngân hàng' },
        { label: 'Phí', value: '2.500 VND' },
        { label: 'Tổng trừ', value: '27.500 VND' },
        {
          label: 'Nhận tiền',
          value: 'Vietcombank - 123456789',
        },
      ],
      title: 'Rút tiền',
    })

    expect(
      describeHistoryItem({
        amount: '10.00',
        assetCode: 'USDT',
        createdAt: '2026-01-01T00:00:00.000Z',
        destinationDetails: {
          method: 'trc20',
          network: 'TRC20',
          walletAddress: 'TXYZ123',
        },
        feeAmount: '0.50',
        id: 'wd-crypto-1',
        kind: 'withdrawal',
        method: 'trc20',
        status: 'pending',
        totalDebit: '10.50',
      }),
    ).toEqual({
      rows: [
        { label: 'Phương thức', value: 'TRC20-USDT' },
        { label: 'Phí', value: '0.50 USDT' },
        { label: 'Tổng trừ', value: '10.50 USDT' },
        {
          label: 'Nhận tiền',
          value: 'TRC20 - TXYZ123',
        },
      ],
      title: 'Rút tiền',
    })

    expect(
      describeHistoryItem({
        amount: '3.80',
        assetCode: 'USDT',
        createdAt: '2026-01-01T00:00:00.000Z',
        feeAmount: '0.04',
        feeAssetCode: 'USDT',
        fromAssetCode: 'VND',
        grossReceiveAmount: '3.84',
        id: 'ex-1',
        kind: 'exchange',
        rate: '26000',
        requestedAmount: '100000',
        totalDebit: '100000',
      }),
    ).toEqual({
      rows: [
        { label: 'Đã trừ', value: '100.000 VND' },
        { label: 'Quy đổi trước phí', value: '3.84 USDT' },
        { label: 'Phí', value: '0.04 USDT' },
        { label: 'Nhận', value: '3.80 USDT' },
        { label: 'Tỷ giá áp dụng', value: '26.000 VND / 1 USDT' },
      ],
      title: 'Đổi tiền',
    })

    expect(
      describeHistoryItem({
        amount: '241785',
        assetCode: 'VND',
        createdAt: '2026-01-01T00:00:00.000Z',
        feeAmount: '1215',
        feeAssetCode: 'VND',
        fromAssetCode: 'USDT',
        grossReceiveAmount: '243000',
        id: 'ex-2',
        kind: 'exchange',
        rate: '24300',
        requestedAmount: '10.00',
        totalDebit: '10.00',
      }),
    ).toEqual({
      rows: [
        { label: 'Đã trừ', value: '10.00 USDT' },
        { label: 'Quy đổi trước phí', value: '243.000 VND' },
        { label: 'Phí', value: '1.215 VND' },
        { label: 'Nhận', value: '241.785 VND' },
        { label: 'Tỷ giá áp dụng', value: '24.300 VND / 1 USDT' },
      ],
      title: 'Đổi tiền',
    })
  })

  it('shows the review note on deposit history so user-cancelled bills are distinguishable from admin rejection', () => {
    expect(
      describeHistoryItem({
        amount: '80000',
        assetCode: 'VND',
        createdAt: '2026-01-01T00:00:00.000Z',
        destinationRef: 'CHUYENTIENABC',
        id: 'dep-user-cancel',
        kind: 'deposit',
        method: 'bank_transfer',
        reviewNote: 'Hủy bởi người dùng',
        status: 'rejected',
      }),
    ).toEqual({
      rows: [
        { label: 'Phương thức', value: 'Chuyển khoản ngân hàng' },
        { label: 'Nội dung', value: 'CHUYENTIENABC' },
        { label: 'Ghi chú', value: 'Hủy bởi người dùng' },
      ],
      title: 'Nạp tiền',
    })
  })

  it('shows the review note on withdrawal history when admin adds a review message', () => {
    expect(
      describeHistoryItem({
        amount: '25000',
        assetCode: 'VND',
        createdAt: '2026-01-01T00:00:00.000Z',
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
        feeAmount: '2500',
        id: 'wd-reviewed',
        kind: 'withdrawal',
        reviewNote: 'Sai thông tin tài khoản nhận',
        status: 'rejected',
        totalDebit: '27500',
      }),
    ).toEqual({
      rows: [
        { label: 'Phương thức', value: 'Chuyển khoản ngân hàng' },
        { label: 'Phí', value: '2.500 VND' },
        { label: 'Tổng trừ', value: '27.500 VND' },
        {
          label: 'Nhận tiền',
          value: 'Vietcombank - 123456789',
        },
        { label: 'Ghi chú', value: 'Sai thông tin tài khoản nhận' },
      ],
      title: 'Rút tiền',
    })
  })
})

describe('filterVisibleHistoryItems', () => {
  it('hides approved, rejected, and completed items after 3 days while keeping pending for 5 days', () => {
    const now = new Date('2026-04-06T12:00:00.000Z').getTime()

    expect(
      filterVisibleHistoryItems(
        [
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-04-03T11:59:59.000Z',
            id: 'approved-old',
            kind: 'deposit',
            approvedAt: '2026-04-03T11:59:59.000Z',
            status: 'approved',
          },
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-04-03T12:00:01.000Z',
            id: 'approved-fresh',
            kind: 'deposit',
            approvedAt: '2026-04-03T12:00:01.000Z',
            status: 'approved',
          },
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-04-01T11:59:59.000Z',
            id: 'pending-old',
            kind: 'withdrawal',
            status: 'pending',
          },
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-04-01T12:00:01.000Z',
            id: 'pending-fresh',
            kind: 'withdrawal',
            status: 'pending',
          },
          {
            amount: '3.000000',
            assetCode: 'USDT',
            createdAt: '2026-04-02T11:59:59.000Z',
            id: 'completed-old',
            kind: 'exchange',
            status: 'completed',
          },
          {
            amount: '3.000000',
            assetCode: 'USDT',
            createdAt: '2026-04-04T12:00:00.000Z',
            id: 'completed-fresh',
            kind: 'exchange',
            status: 'completed',
          },
        ],
        now,
      ).map((item) => item.id),
    ).toEqual(['approved-fresh', 'pending-fresh', 'completed-fresh'])
  })

  it('uses approval and rejection timestamps instead of creation time for finalized deposits and withdrawals', () => {
    const now = new Date('2026-04-06T12:00:00.000Z').getTime()

    expect(
      filterVisibleHistoryItems(
        [
          {
            amount: '100000',
            approvedAt: '2026-04-05T12:00:00.000Z',
            assetCode: 'VND',
            createdAt: '2026-03-20T12:00:00.000Z',
            id: 'approved-recently',
            kind: 'deposit',
            status: 'approved',
          },
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-03-20T12:00:00.000Z',
            id: 'rejected-long-ago',
            kind: 'withdrawal',
            rejectedAt: '2026-04-02T11:59:59.000Z',
            status: 'rejected',
          },
        ],
        now,
      ).map((item) => item.id),
    ).toEqual(['approved-recently'])
  })

  it('keeps items with unknown status visible by default', () => {
    const now = new Date('2026-04-10T00:00:00.000Z').getTime()

    expect(
      filterVisibleHistoryItems(
        [
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-03-01T00:00:00.000Z',
            id: 'unknown',
            kind: 'deposit',
          },
        ],
        now,
      ),
    ).toHaveLength(1)
  })

  it('treats cancelled items as finalized when applying the visibility window', () => {
    const now = new Date('2026-04-06T12:00:00.000Z').getTime()

    expect(
      filterVisibleHistoryItems(
        [
          {
            amount: '75000',
            assetCode: 'VND',
            cancelledAt: '2026-04-03T11:59:59.000Z',
            createdAt: '2026-04-01T12:00:00.000Z',
            id: 'cancelled-old',
            kind: 'deposit',
            status: 'cancelled',
          },
          {
            amount: '50000',
            assetCode: 'VND',
            cancelledAt: '2026-04-04T12:00:00.000Z',
            createdAt: '2026-04-02T12:00:00.000Z',
            id: 'cancelled-recent',
            kind: 'withdrawal',
            status: 'cancelled',
          },
        ],
        now,
      ).map((item) => item.id),
    ).toEqual(['cancelled-recent'])
  })
})
