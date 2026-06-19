import { describe, expect, it } from 'vitest'

import { formatUsdt } from './format'

describe('formatUsdt', () => {
  it('floors USDT to two fractional digits by default', () => {
    expect(formatUsdt('0.189')).toBe('0.18')
    expect(formatUsdt('200.115')).toBe('200.11')
    expect(formatUsdt('0.18')).toBe('0.18')
    expect(formatUsdt('12')).toBe('12.00')
  })
})
