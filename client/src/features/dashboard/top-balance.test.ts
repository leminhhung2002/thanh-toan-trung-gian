import { describe, expect, it } from 'vitest'

import { getDashboardVndBalanceLabel } from './top-balance'

describe('dashboard top balance helpers', () => {
  it('formats the current VND balance for drawer headers', () => {
    expect(getDashboardVndBalanceLabel('1250000')).toBe('1.250.000')
    expect(getDashboardVndBalanceLabel()).toBe('0')
  })
})
