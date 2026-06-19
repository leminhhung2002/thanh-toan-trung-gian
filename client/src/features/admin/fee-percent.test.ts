import { describe, expect, it } from 'vitest'

import {
  formatFeePercentInputFromBps,
  parseFeePercentInputToBps,
} from './fee-percent'

describe('admin fee percent helpers', () => {
  it('formats backend bps values into normal percent strings for the admin form', () => {
    expect(formatFeePercentInputFromBps(100)).toBe('1')
    expect(formatFeePercentInputFromBps(50)).toBe('0.5')
    expect(formatFeePercentInputFromBps(1000)).toBe('10')
    expect(formatFeePercentInputFromBps(0)).toBe('0')
  })

  it('parses normal percent inputs back into integer bps values', () => {
    expect(parseFeePercentInputToBps('1')).toBe(100)
    expect(parseFeePercentInputToBps('0.5')).toBe(50)
    expect(parseFeePercentInputToBps('10')).toBe(1000)
    expect(parseFeePercentInputToBps('100')).toBe(10000)
  })

  it('rejects invalid percent input outside 0-100 or with too many decimals', () => {
    expect(parseFeePercentInputToBps('-1')).toBeNull()
    expect(parseFeePercentInputToBps('100.01')).toBeNull()
    expect(parseFeePercentInputToBps('1.234')).toBeNull()
    expect(parseFeePercentInputToBps('abc')).toBeNull()
  })
})
