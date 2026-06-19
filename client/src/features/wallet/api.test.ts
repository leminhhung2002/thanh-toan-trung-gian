import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}))

vi.mock('#/lib/api/app-client', () => ({
  apiClient: {
    delete: mocks.delete,
    get: mocks.get,
    post: mocks.post,
  },
}))

vi.mock('#/lib/utils/idempotency', () => ({
  createIdempotencyKey: vi.fn((scope: string) => `idem-${scope}`),
}))

const { walletApi } = await import('./api')

describe('wallet api helpers', () => {
  beforeEach(() => {
    mocks.delete.mockReset()
    mocks.get.mockReset()
    mocks.post.mockReset()
  })

  it('builds deposit reservation endpoints for the VND bank-transfer flow', async () => {
    mocks.post.mockResolvedValueOnce({
      reservationId: 'reservation-1',
    })
    mocks.get.mockResolvedValueOnce({
      reservationId: 'reservation-1',
      status: 'active',
    })
    mocks.get.mockResolvedValueOnce([
      {
        reservationId: 'reservation-1',
        status: 'active',
      },
    ])
    mocks.post.mockResolvedValueOnce({
      id: 'deposit-1',
    })
    mocks.post.mockResolvedValueOnce({
      success: true,
    })

    await walletApi.createDepositReservation({
      amount: '50000',
      assetCode: 'VND',
      method: 'bank_transfer',
    })
    await walletApi.getCurrentDepositReservation()
    await walletApi.listDepositReservations()
    await walletApi.confirmDepositReservation('reservation-1')
    await walletApi.cancelDepositReservation('reservation-1')

    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/deposit-reservations',
      {
        amount: '50000',
        assetCode: 'VND',
        method: 'bank_transfer',
      },
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/deposit-reservations/reservation-1/confirm',
      {},
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      3,
      '/deposit-reservations/reservation-1/cancel',
      {},
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(1, '/deposit-reservations/current', {
      auth: true,
    })
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/deposit-reservations', {
      auth: true,
    })
  })

  it('loads financial fee settings and submits withdrawal requests with amount-as-gross semantics', async () => {
    mocks.get.mockResolvedValueOnce({
      exchangeUsdtToVndFeeBps: 50,
      exchangeUsdtToVndMarkupVnd: 700,
      exchangeVndToUsdtFeeBps: 100,
      exchangeVndToUsdtMarkupVnd: 1000,
      withdrawalUsdtFeeBps: 0,
      withdrawalVndFeeBps: 1000,
    })
    mocks.post.mockResolvedValueOnce({
      amount: '100000',
      assetCode: 'VND',
      feeAmount: '10000',
      id: 'withdrawal-1',
      status: 'pending',
      totalDebit: '110000',
    })

    await walletApi.getFinancialSettings()
    await walletApi.createWithdrawal({
      amount: '100000',
      assetCode: 'VND',
      currentPassword: 'Secret123!',
      destinationDetails: {
        accountName: 'NGUYEN VAN A',
        accountNumber: '123456789',
        bankName: 'Vietcombank',
        method: 'bank_transfer',
      },
      method: 'bank_transfer',
      note: 'Rút VND',
    })

    expect(mocks.get).toHaveBeenCalledWith('/settings/financial', {
      auth: true,
    })
    expect(mocks.post).toHaveBeenCalledWith(
      '/withdrawals',
      {
        amount: '100000',
        assetCode: 'VND',
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        },
        method: 'bank_transfer',
        note: 'Rút VND',
        currentPassword: 'Secret123!',
      },
      {
        auth: true,
        headers: {
          'Idempotency-Key': 'idem-withdrawal',
        },
      },
    )
  })

  it('submits TRC20 withdrawals using the selected network as a distinct method', async () => {
    mocks.post.mockResolvedValueOnce({
      amount: '10',
      assetCode: 'USDT',
      feeAmount: '1',
      id: 'withdrawal-2',
      status: 'pending',
      totalDebit: '11',
    })

    await walletApi.createWithdrawal({
      amount: '10',
      assetCode: 'USDT',
      currentPassword: 'Secret123!',
      destinationDetails: {
        method: 'trc20',
        network: 'TRC20',
        walletAddress: 'TXYZ123',
      },
      method: 'trc20',
      note: 'Rút USDT qua mạng TRC20',
    })

    expect(mocks.post).toHaveBeenCalledWith(
      '/withdrawals',
      {
        amount: '10',
        assetCode: 'USDT',
        destinationDetails: {
          method: 'trc20',
          network: 'TRC20',
          walletAddress: 'TXYZ123',
        },
        method: 'trc20',
        note: 'Rút USDT qua mạng TRC20',
        currentPassword: 'Secret123!',
      },
      {
        auth: true,
        headers: {
          'Idempotency-Key': 'idem-withdrawal',
        },
      },
    )
  })

  it('loads public display settings without auth for the support link', async () => {
    mocks.get.mockResolvedValueOnce({
      homepageBanners: [],
      supportLink: 'https://t.me/nganluong_support',
    })

    await walletApi.getDisplaySettings()

    expect(mocks.get).toHaveBeenCalledWith('/settings/display')
  })

  it('builds cancel endpoints for pending deposits and withdrawals from history', async () => {
    mocks.post.mockResolvedValue({ success: true })

    await walletApi.cancelDeposit('deposit-1')
    await walletApi.cancelWithdrawal('withdrawal-1')

    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/deposits/deposit-1/cancel',
      {},
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/withdrawals/withdrawal-1/cancel',
      {},
      { auth: true },
    )
  })
})
