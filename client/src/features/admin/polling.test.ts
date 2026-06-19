import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { getAdminPollingOptions } from './polling'

const clientRoot = path.resolve(import.meta.dirname, '../..')

describe('getAdminPollingOptions', () => {
  it('enables 5-second polling for the transactions tab only while active', () => {
    expect(
      getAdminPollingOptions({ activeTab: 'transactions', targetTab: 'transactions' }),
    ).toEqual({
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    })
  })

  it('enables 5-second polling for the banks tab only while active', () => {
    expect(getAdminPollingOptions({ activeTab: 'banks', targetTab: 'banks' })).toEqual({
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    })
  })

  it('enables 5-second polling for the exchange tab only while active', () => {
    expect(getAdminPollingOptions({ activeTab: 'exchange', targetTab: 'exchange' })).toEqual({
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    })
  })

  it('enables 5-second polling for the withdrawals tab only while active', () => {
    expect(
      getAdminPollingOptions({ activeTab: 'withdrawals', targetTab: 'withdrawals' }),
    ).toEqual({
      refetchInterval: 5000,
      refetchIntervalInBackground: false,
    })
  })

  it('disables polling for non-matching tabs', () => {
    expect(getAdminPollingOptions({ activeTab: 'overview', targetTab: 'transactions' })).toEqual({
      refetchInterval: false,
      refetchIntervalInBackground: false,
    })
  })
})

describe('admin page polling wiring', () => {
  it('applies polling to admin withdrawals and exchange queries', () => {
    const adminPage = readFileSync(
      path.join(clientRoot, 'features/admin/admin-page.tsx'),
      'utf8',
    )

    expect(adminPage).toContain('const adminWithdrawalsPolling = getAdminPollingOptions({')
    expect(adminPage).toContain('const adminExchangePolling = getAdminPollingOptions({')
    expect(adminPage).toContain("targetTab: 'withdrawals'")
    expect(adminPage).toContain('...adminWithdrawalsPolling,')
    expect(adminPage).toContain('...adminExchangePolling,')
  })
})
