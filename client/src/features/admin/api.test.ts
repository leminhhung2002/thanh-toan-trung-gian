import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
  postFormData: vi.fn(),
}))

vi.mock('#/lib/api/app-client', () => ({
  apiClient: {
    delete: mocks.delete,
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
    postFormData: mocks.postFormData,
  },
}))

const { adminApi } = await import('./api')

describe('admin api helpers', () => {
  beforeEach(() => {
    mocks.delete.mockReset()
    mocks.get.mockReset()
    mocks.patch.mockReset()
    mocks.post.mockReset()
    mocks.postFormData.mockReset()
  })

  it('builds filtered list endpoints for deposits and withdrawals', async () => {
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])

    await adminApi.listDeposits('approved')
    await adminApi.listWithdrawals('rejected')
    await adminApi.listDeposits()
    await adminApi.listWithdrawals()
    await adminApi.listDeposits('pending', '2026-04-06', '2026-04-08')
    await adminApi.listWithdrawals('all', '2026-04-06', '2026-04-08')
    await adminApi.listDeposits('pending', '2026-04-06', '2026-04-08', 'alice')
    await adminApi.listWithdrawals('all', '2026-04-06', '2026-04-08', '0901')

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/admin/deposits?status=approved',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      2,
      '/admin/withdrawals?status=rejected',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      3,
      '/admin/deposits?status=all',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      4,
      '/admin/withdrawals?status=all',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      5,
      '/admin/deposits?status=pending&startDate=2026-04-06&endDate=2026-04-08',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      6,
      '/admin/withdrawals?status=all&startDate=2026-04-06&endDate=2026-04-08',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      7,
      '/admin/deposits?status=pending&startDate=2026-04-06&endDate=2026-04-08&search=alice',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      8,
      '/admin/withdrawals?status=all&startDate=2026-04-06&endDate=2026-04-08&search=0901',
      { auth: true },
    )
  })

  it('builds a date-filtered admin exchange orders endpoint', async () => {
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])

    await adminApi.listExchangeOrders()
    await adminApi.listExchangeOrders('2026-04-06', '2026-04-08')
    await adminApi.listExchangeOrders('2026-04-06', '2026-04-08', 'user-1')

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/admin/exchange/orders',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      2,
      '/admin/exchange/orders?startDate=2026-04-06&endDate=2026-04-08',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(
      3,
      '/admin/exchange/orders?startDate=2026-04-06&endDate=2026-04-08&search=user-1',
      { auth: true },
    )
  })

  it('sends review note fields to approve and reject actions', async () => {
    mocks.post.mockResolvedValue({ success: true })

    await adminApi.rejectWithdrawal('tx-1', { note: 'check bank slip' })
    await adminApi.restoreDepositPending('deposit-1')
    await adminApi.restoreWithdrawalPending('withdrawal-1')
    await adminApi.reverseExchangeOrder('exchange-1')

    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/admin/withdrawals/tx-1/reject',
      {
        note: 'check bank slip',
      },
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/admin/deposits/deposit-1/restore-pending',
      {},
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      3,
      '/admin/withdrawals/withdrawal-1/restore-pending',
      {},
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      4,
      '/admin/exchange/orders/exchange-1/reverse',
      {},
      { auth: true },
    )
  })

  it('builds CRUD endpoints for admin bank accounts', async () => {
    mocks.get.mockResolvedValueOnce([])
    mocks.post.mockResolvedValueOnce({ id: 'bank-1' })
    mocks.post.mockResolvedValueOnce({ success: true })

    await adminApi.listBankAccounts()
    await adminApi.createBankAccount({
      accountName: 'NGAN LUONG',
      accountNumber: '123456789',
      bankCode: '970436',
      bankName: 'Vietcombank',
      dailyLimit: '1000000',
      isActive: true,
      priority: 1,
    })
    await adminApi.resetBankAccountUsage()

    expect(mocks.get).toHaveBeenCalledWith('/admin/bank-accounts', {
      auth: true,
    })
    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/admin/bank-accounts',
      {
        accountName: 'NGAN LUONG',
        accountNumber: '123456789',
        bankCode: '970436',
        bankName: 'Vietcombank',
        dailyLimit: '1000000',
        isActive: true,
        priority: 1,
      },
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      2,
      '/admin/bank-accounts/reset-daily-usage',
      {},
      { auth: true },
    )
  })

  it('loads and updates admin settings for reservation ttl, fee percentages, and display config', async () => {
    mocks.get.mockResolvedValueOnce({
      depositReservationTtlMinutes: 15,
      exchangeUsdtToVndFeeBps: 50,
      exchangeUsdtToVndMarkupVnd: 700,
      exchangeVndToUsdtFeeBps: 100,
      exchangeVndToUsdtMarkupVnd: 1000,
      homepageBanners: [],
      supportLink: 'https://t.me/nganluong_support',
      withdrawalUsdtFeeBps: 0,
      withdrawalVndFeeBps: 1000,
    })
    mocks.patch.mockResolvedValueOnce({
      depositReservationTtlMinutes: 20,
      exchangeUsdtToVndFeeBps: 75,
      exchangeUsdtToVndMarkupVnd: 900,
      exchangeVndToUsdtFeeBps: 150,
      exchangeVndToUsdtMarkupVnd: 1500,
      homepageBanners: [],
      supportLink: 'https://t.me/nganluong_hotline',
      withdrawalUsdtFeeBps: 100,
      withdrawalVndFeeBps: 900,
    })

    await adminApi.getSettings()
    await adminApi.updateSettings({
      depositReservationTtlMinutes: 20,
      exchangeUsdtToVndFeeBps: 75,
      exchangeUsdtToVndMarkupVnd: 900,
      exchangeVndToUsdtFeeBps: 150,
      exchangeVndToUsdtMarkupVnd: 1500,
      supportLink: 'https://t.me/nganluong_hotline',
      withdrawalUsdtFeeBps: 100,
      withdrawalVndFeeBps: 900,
    })

    expect(mocks.get).toHaveBeenCalledWith('/admin/settings', {
      auth: true,
    })
    expect(mocks.patch).toHaveBeenCalledWith(
      '/admin/settings',
      {
        depositReservationTtlMinutes: 20,
        exchangeUsdtToVndFeeBps: 75,
        exchangeUsdtToVndMarkupVnd: 900,
        exchangeVndToUsdtFeeBps: 150,
        exchangeVndToUsdtMarkupVnd: 1500,
        supportLink: 'https://t.me/nganluong_hotline',
        withdrawalUsdtFeeBps: 100,
        withdrawalVndFeeBps: 900,
      },
      { auth: true },
    )
  })

  it('loads and updates the Telegram runtime integration separately from generic admin settings', async () => {
    mocks.get.mockResolvedValueOnce({
      botUsername: 'nganluong_bot',
      chatId: '-1001234567890',
      configured: true,
      lastValidatedAt: '2026-04-09T03:00:00.000Z',
      tokenSuffix: 'CDEF',
      updatedAt: '2026-04-09T03:00:00.000Z',
      version: 2,
    })
    mocks.patch.mockResolvedValueOnce({
      botUsername: 'nganluong_bot',
      chatId: '-100999000111',
      configured: true,
      lastValidatedAt: '2026-04-09T03:05:00.000Z',
      tokenSuffix: 'WXYZ',
      updatedAt: '2026-04-09T03:05:00.000Z',
      version: 3,
    })

    await adminApi.getTelegramRuntimeConfig()
    await adminApi.updateTelegramRuntimeConfig({
      chatId: '-100999000111',
      token: '123456:NEWTOKEN',
    })

    expect(mocks.get).toHaveBeenCalledWith('/admin/integrations/telegram', {
      auth: true,
    })
    expect(mocks.patch).toHaveBeenCalledWith(
      '/admin/integrations/telegram',
      {
        chatId: '-100999000111',
        token: '123456:NEWTOKEN',
      },
      { auth: true },
    )
  })

  it('builds homepage banner admin endpoints', async () => {
    const formData = new FormData()
    formData.set('image', new File(['banner'], 'banner.png', { type: 'image/png' }))

    mocks.postFormData.mockResolvedValueOnce({
      height: 500,
      id: 'banner-1',
      imageUrl: '/api/v1/public/homepage-banners/banner-1.png',
      sortOrder: 0,
      width: 1600,
    })
    mocks.patch.mockResolvedValueOnce({
      homepageBanners: [
        {
          height: 500,
          id: 'banner-2',
          imageUrl: '/api/v1/public/homepage-banners/banner-2.png',
          sortOrder: 0,
          width: 1600,
        },
        {
          height: 500,
          id: 'banner-1',
          imageUrl: '/api/v1/public/homepage-banners/banner-1.png',
          sortOrder: 1,
          width: 1600,
        },
      ],
    })
    mocks.delete.mockResolvedValueOnce({ success: true })

    await adminApi.uploadHomepageBanner(formData)
    await adminApi.reorderHomepageBanners(['banner-2', 'banner-1'])
    await adminApi.deleteHomepageBanner('banner-1')

    expect(mocks.postFormData).toHaveBeenCalledWith(
      '/admin/settings/banners',
      formData,
      { auth: true },
    )
    expect(mocks.patch).toHaveBeenCalledWith(
      '/admin/settings/banners/order',
      { bannerIds: ['banner-2', 'banner-1'] },
      { auth: true },
    )
    expect(mocks.delete).toHaveBeenCalledWith('/admin/settings/banners/banner-1', {
      auth: true,
    })
  })

  it('builds admin user management endpoints', async () => {
    mocks.get.mockResolvedValueOnce([])
    mocks.get.mockResolvedValueOnce([])
    mocks.patch.mockResolvedValue({ success: true })
    mocks.post.mockResolvedValue({ success: true })

    await adminApi.listUsers('wallet')
    await adminApi.listRoleOptions()
    await adminApi.updateUserProfile('user-1', {
      email: 'wallet@example.com',
      phone: '0901234567',
      telegram: '@wallet',
    })
    await adminApi.updateUserRoles('user-1', {
      roles: ['user', 'admin'],
    })
    await adminApi.updateUserPassword('user-1', {
      newPassword: 'Changed123!',
    })
    await adminApi.overwriteUserBalances('user-1', {
      usdt: '3.500000',
      vnd: '150000',
    })
    await adminApi.addUserBalance('user-1', {
      amount: '25000',
      assetCode: 'VND',
    })

    expect(mocks.get).toHaveBeenNthCalledWith(
      1,
      '/admin/users?search=wallet',
      { auth: true },
    )
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/admin/users/roles', {
      auth: true,
    })
    expect(mocks.patch).toHaveBeenNthCalledWith(
      1,
      '/admin/users/user-1/profile',
      {
        email: 'wallet@example.com',
        phone: '0901234567',
        telegram: '@wallet',
      },
      { auth: true },
    )
    expect(mocks.patch).toHaveBeenNthCalledWith(
      2,
      '/admin/users/user-1/roles',
      {
        roles: ['user', 'admin'],
      },
      { auth: true },
    )
    expect(mocks.patch).toHaveBeenNthCalledWith(
      3,
      '/admin/users/user-1/password',
      {
        newPassword: 'Changed123!',
      },
      { auth: true },
    )
    expect(mocks.patch).toHaveBeenNthCalledWith(
      4,
      '/admin/users/user-1/balances',
      {
        usdt: '3.500000',
        vnd: '150000',
      },
      { auth: true },
    )
    expect(mocks.post).toHaveBeenNthCalledWith(
      1,
      '/admin/users/user-1/add-balance',
      {
        amount: '25000',
        assetCode: 'VND',
      },
      { auth: true },
    )
  })
})
