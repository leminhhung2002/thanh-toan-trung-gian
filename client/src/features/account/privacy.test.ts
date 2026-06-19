import { describe, expect, it } from 'vitest'

import {
  getSensitiveFieldDisplayValue,
  maskSensitiveValue,
} from './privacy'

describe('maskSensitiveValue', () => {
  it('shows only the first two and last two characters for long values', () => {
    expect(maskSensitiveValue('0901234567')).toBe('09******67')
    expect(maskSensitiveValue('user@example.com')).toBe('us************om')
    expect(maskSensitiveValue('walletuser')).toBe('wa******er')
  })

  it('keeps short values visible and returns the empty fallback for missing values', () => {
    expect(maskSensitiveValue('1234')).toBe('1234')
    expect(maskSensitiveValue('123')).toBe('123')
    expect(maskSensitiveValue('')).toBe('Chưa cập nhật')
    expect(maskSensitiveValue(null)).toBe('Chưa cập nhật')
  })
})

describe('getSensitiveFieldDisplayValue', () => {
  it('always returns the masked value for account fields', () => {
    expect(
      getSensitiveFieldDisplayValue({
        kind: 'email',
        value: 'user@example.com',
      }),
    ).toBe('us************om')

    expect(
      getSensitiveFieldDisplayValue({
        kind: 'telegram',
        value: 'walletuser',
      }),
    ).toBe('wa******er')
    })

  it('shares the same masking rule for phone values', () => {
    expect(
      getSensitiveFieldDisplayValue({
        kind: 'phone',
        value: '0901234567',
      }),
    ).toBe('09******67')
  })
})
