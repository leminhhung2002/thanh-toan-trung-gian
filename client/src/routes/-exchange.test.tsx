// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ExchangeQuote, FinancialSettings, WalletSummary } from '#/lib/types'
import { ApiClientError } from '#/lib/api/client'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-router')>()

  return {
    ...actual,
    createFileRoute: () => () => ({ component: null }),
    useNavigate: () => navigateMock,
  }
})

const walletApiMock = vi.hoisted(() => ({
  getFinancialSettings: vi.fn(),
  listWallets: vi.fn(),
}))

const exchangeApiMock = vi.hoisted(() => ({
  createQuote: vi.fn(),
  execute: vi.fn(),
}))

vi.mock('#/features/auth/route-gates', () => ({
  RequireUser: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('#/components/screen-loader', () => ({
  ScreenLoader: () => <div>Đang tải...</div>,
}))

vi.mock('#/features/wallet/api', () => ({
  walletApi: walletApiMock,
}))

vi.mock('#/features/exchange/api', () => ({
  exchangeApi: exchangeApiMock,
}))

const { ExchangeScreen } = await import('./exchange')

afterEach(() => {
  cleanup()
  navigateMock.mockReset()
  Object.values(walletApiMock).forEach((mock) => mock.mockReset())
  Object.values(exchangeApiMock).forEach((mock) => mock.mockReset())
})

function createWallet(assetCode: 'VND' | 'USDT', available: string): WalletSummary {
  return {
    assetCode,
    assetName: assetCode,
    balances: {
      available,
      pending: '0',
      total: available,
    },
    walletId: `wallet-${assetCode.toLowerCase()}`,
  }
}

function mockExchangeDependencies(input?: {
  financialSettings?: FinancialSettings
  quote?: ExchangeQuote
}) {
  const financialSettings: FinancialSettings = input?.financialSettings ?? {
    exchangeUsdtToVndFeeBps: 50,
    exchangeUsdtToVndMarkupVnd: 0,
    exchangeVndToUsdtFeeBps: 100,
    exchangeVndToUsdtMarkupVnd: 0,
    withdrawalUsdtFeeBps: 0,
    withdrawalVndFeeBps: 0,
  }

  walletApiMock.listWallets.mockResolvedValue([
    createWallet('VND', '500000'),
    createWallet('USDT', '25'),
  ])
  walletApiMock.getFinancialSettings.mockResolvedValue(financialSettings)

  if (input?.quote) {
    exchangeApiMock.createQuote.mockResolvedValue(input.quote)
  }
}

function renderExchangeScreen() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  })

  return render(
    <QueryClientProvider client={queryClient}>
      <ExchangeScreen />
    </QueryClientProvider>,
  )
}

describe('ExchangeScreen', () => {
  it('shows the exchange fee hint under the source amount label and updates it when the direction changes', async () => {
    mockExchangeDependencies()

    renderExchangeScreen()

    expect(await screen.findByText('Đổi tiền')).toBeTruthy()
    expect(screen.getByText('Phí giao dịch 1%: --')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Đảo chiều VND sang USDT' }))

    await waitFor(() => {
      expect(screen.getByText('Phí giao dịch 0.50%: --')).toBeTruthy()
    })
  })

  it('shows the quoted fee amount using the exchange fee asset', async () => {
    mockExchangeDependencies({
      quote: {
        expiresAt: '2026-04-12T12:05:00.000Z',
        feeAmount: '0.04',
        feeAssetCode: 'USDT',
        feeBps: 100,
        fromAmount: '100000',
        fromAssetCode: 'VND',
        grossReceiveAmount: '3.84',
        id: 'quote-1',
        rate: '25000',
        requestedAmount: '100000',
        roundingMode: 'floor',
        toAmount: '3.80',
        toAssetCode: 'USDT',
        totalDebit: '100000',
      },
    })

    renderExchangeScreen()

    expect(await screen.findByText('Đổi tiền')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '100000' },
    })

    await waitFor(() => {
      expect(exchangeApiMock.createQuote).toHaveBeenCalled()
    })

    expect(await screen.findByText('Phí giao dịch 1%: 0.04 USDT')).toBeTruthy()
    expect(screen.getByText('3.80')).toBeTruthy()
    expect(screen.queryByText('Nhận được')).toBeNull()
    expect(screen.queryByText('Quy đổi trước phí')).toBeNull()
    expect(screen.queryByText('Phí giao dịch')).toBeNull()
    expect(screen.queryByText('Tổng trừ')).toBeNull()
  })

  it('shows quote errors from the exchange quote query', async () => {
    mockExchangeDependencies()
    exchangeApiMock.createQuote.mockRejectedValueOnce(
      new ApiClientError({
        code: 'exchange_amount_below_fee',
        message: 'Số tiền đổi phải lớn hơn phí giao dịch để nhận được tiền.',
        status: 400,
      }),
    )

    renderExchangeScreen()

    expect(await screen.findByText('Đổi tiền')).toBeTruthy()

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '1' },
    })

    expect(
      await screen.findByText('Số tiền đổi phải lớn hơn phí giao dịch để nhận được tiền.'),
    ).toBeTruthy()
  })
})
