import { describe, expect, it } from 'vitest'

import { getDashboardMethodOptions } from './method-selector'

describe('dashboard method selector', () => {
  it('shows only the VND deposit method while keeping VND first for withdrawals', () => {
    expect(getDashboardMethodOptions('deposit')).toEqual([
      { meta: 'Chuyển khoản', title: 'VNĐ', value: 'vnd' },
    ])

    expect(getDashboardMethodOptions('withdrawal')).toEqual([
      { meta: 'Chuyển khoản', title: 'VNĐ', value: 'vnd' },
      { meta: 'BEP20 / TRC20', title: 'USDT', value: 'usdt' },
    ])
  })
})
