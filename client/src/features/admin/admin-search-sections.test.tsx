// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ExchangeSection, ReviewSection } from './admin-page'

describe('admin search section toolbars', () => {
  it('renders a search control in review sections when provided', () => {
    render(
      <ReviewSection
        emptyMessage="Không có dữ liệu"
        filterBar={<div>status filters</div>}
        isPending={false}
        isRefreshing={false}
        items={[
          {
            amount: '100000',
            assetCode: 'VND',
            createdAt: '2026-04-10T00:00:00.000Z',
            id: 'deposit-1',
            method: 'bank_transfer',
            status: 'pending',
            userEmail: 'alice@example.com',
          },
        ]}
        loadingMessage="Đang tải"
        noteMap={{}}
        onApprove={async () => undefined}
        onNoteChange={() => undefined}
        onReject={async () => undefined}
        onRefresh={() => undefined}
        pendingLabel="Nạp tiền"
        renderDetails={() => <div>chi tiết</div>}
        searchBox={<input aria-label="search-transactions" />}
        statusFilter="pending"
        submittingApprove={false}
        submittingReject={false}
      />,
    )

    expect(screen.getByLabelText('search-transactions')).toBeTruthy()
    expect(screen.getByText('status filters')).toBeTruthy()
  })

  it('renders a search control in the exchange section when provided', () => {
    render(
      <ExchangeSection
        dateFilter={<div>date filter</div>}
        exchangeOrders={[
          {
            appliedMarkupVnd: 1000,
            createdAt: '2026-04-10T00:00:00.000Z',
            feeAmount: '0.01',
            feeAssetCode: 'USDT',
            feeBps: 100,
            feeProfitVnd: '250',
            fromAssetCode: 'VND',
            grossReceiveAmount: '1.01',
            id: 'exchange-1',
            markupProfitVnd: '500',
            rate: '26000',
            realtimeRateVnd: '25000',
            requestedAmount: '26000',
            status: 'completed',
            toAmount: '1.00',
            toAssetCode: 'USDT',
            totalDebit: '26000',
            userEmail: 'alice@example.com',
            userId: 'user-1',
          },
        ]}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        searchBox={<input aria-label="search-exchange" />}
      />,
    )

    expect(screen.getByLabelText('search-exchange')).toBeTruthy()
    expect(screen.getByText('date filter')).toBeTruthy()
  })

  it('shows a reverse action only for completed exchange orders', () => {
    render(
      <ExchangeSection
        dateFilter={<div>date filter</div>}
        exchangeOrders={[
          {
            appliedMarkupVnd: 1000,
            createdAt: '2026-04-10T00:00:00.000Z',
            feeAmount: '0.01',
            feeAssetCode: 'USDT',
            feeBps: 100,
            feeProfitVnd: '250',
            fromAssetCode: 'VND',
            grossReceiveAmount: '1.01',
            id: 'exchange-1',
            markupProfitVnd: '500',
            rate: '26000',
            realtimeRateVnd: '25000',
            requestedAmount: '26000',
            status: 'completed',
            toAmount: '1.00',
            toAssetCode: 'USDT',
            totalDebit: '26000',
            userEmail: 'alice@example.com',
            userId: 'user-1',
          },
          {
            appliedMarkupVnd: 700,
            createdAt: '2026-04-10T01:00:00.000Z',
            feeAmount: '1215',
            feeAssetCode: 'VND',
            feeBps: 50,
            feeProfitVnd: '1215',
            fromAssetCode: 'USDT',
            grossReceiveAmount: '243000',
            id: 'exchange-2',
            markupProfitVnd: '7000',
            rate: '24300',
            realtimeRateVnd: '25000',
            requestedAmount: '10.00',
            status: 'reversed' as const,
            toAmount: '241785',
            toAssetCode: 'VND',
            totalDebit: '10.00',
            userEmail: 'bob@example.com',
            userId: 'user-2',
          },
        ]}
        isPending={false}
        isRefreshing={false}
        onRefresh={() => undefined}
        onReverse={async () => undefined}
      />,
    )

    expect(screen.getByRole('button', { name: 'Khôi phục đổi tiền' })).toBeTruthy()
    expect(screen.getByText('Đã khôi phục')).toBeTruthy()
  })
})
