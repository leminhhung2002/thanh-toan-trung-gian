import { describe, expect, it } from 'vitest'

import { queryKeys } from './query-keys'

describe('queryKeys', () => {
  it('includes search terms in admin transaction query keys', () => {
    expect(
      queryKeys.adminDeposits('pending', '2026-04-06', '2026-04-08', 'alice'),
    ).toEqual(['admin', 'deposits', 'pending', '2026-04-06', '2026-04-08', 'alice'])

    expect(
      queryKeys.adminWithdrawals('approved', '2026-04-06', '2026-04-08', '0901'),
    ).toEqual([
      'admin',
      'withdrawals',
      'approved',
      '2026-04-06',
      '2026-04-08',
      '0901',
    ])

    expect(
      queryKeys.adminExchangeOrders('2026-04-06', '2026-04-08', 'user-1'),
    ).toEqual(['admin', 'exchange', 'orders', '2026-04-06', '2026-04-08', 'user-1'])
  })
})
