import { describe, expect, it } from 'vitest'

import {
  calculateFeePreview,
  formatBpsPercent,
  getFinancialSettingsGate,
} from './fees'

describe('formatBpsPercent', () => {
  it('formats basis points into a readable percent string', () => {
    expect(formatBpsPercent(1500)).toBe('15%')
    expect(formatBpsPercent(125)).toBe('1.25%')
  })
})

describe('calculateFeePreview', () => {
  it('rounds VND fees up so the user net amount reflects the platform-favoring fee', () => {
    expect(calculateFeePreview('101', 125, 'VND')).toEqual({
      feeAmount: 2,
      netReceive: 99,
      totalDebit: 101,
    })
  })

  it('rounds USDT fees up and rounds the user net amount down to two decimals', () => {
    expect(calculateFeePreview('777.847280', 750, 'USDT')).toEqual({
      feeAmount: 58.34,
      netReceive: 719.5,
      totalDebit: 777.84,
    })
  })

  it('charges the extra fractional cent to the platform for USDT fee-based flows', () => {
    expect(calculateFeePreview('10.00', 125, 'USDT')).toEqual({
      feeAmount: 0.13,
      netReceive: 9.87,
      totalDebit: 10,
    })
  })
})

describe('getFinancialSettingsGate', () => {
  it('blocks fee-sensitive UI while settings are loading or unavailable', () => {
    expect(
      getFinancialSettingsGate({
        context: 'withdrawal',
        isError: false,
        isPending: true,
        settings: undefined,
      }),
    ).toEqual({
      isReady: false,
      message: 'Đang tải cấu hình phí rút tiền...',
    })

    expect(
      getFinancialSettingsGate({
        context: 'exchange',
        isError: true,
        isPending: false,
        settings: undefined,
      }),
    ).toEqual({
      isReady: false,
      message: 'Không thể tải cấu hình tỷ giá đổi tiền. Vui lòng thử lại sau.',
    })

    expect(
      getFinancialSettingsGate({
        context: 'exchange',
        isError: false,
        isPending: false,
        settings: {
          exchangeUsdtToVndFeeBps: 50,
          exchangeUsdtToVndMarkupVnd: 700,
          exchangeVndToUsdtFeeBps: 100,
          exchangeVndToUsdtMarkupVnd: 1000,
          withdrawalUsdtFeeBps: 0,
          withdrawalVndFeeBps: 1000,
        },
      }),
    ).toEqual({
      isReady: true,
      message: '',
    })
  })
})
