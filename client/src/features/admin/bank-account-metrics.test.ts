import { describe, expect, it } from 'vitest'

import { getCapacityPercent, getConsumedCapacity } from './bank-account-metrics'

describe('bank account metrics', () => {
  it('sums usedToday, reservedUnconfirmed, and reservedPendingReview into consumed capacity', () => {
    expect(
      getConsumedCapacity({
        reservedPendingReview: '15000',
        reservedUnconfirmed: '25000',
        usedToday: '60000',
      }),
    ).toBe(100000)
  })

  it('caps the capacity percentage at 100%', () => {
    expect(
      getCapacityPercent({
        dailyLimit: '100000',
        reservedPendingReview: '20000',
        reservedUnconfirmed: '30000',
        usedToday: '70000',
      }),
    ).toBe(100)
  })
})
