import { describe, expect, it } from 'vitest'

import {
  getExchangeAssetTone,
  getExchangeBalanceCardUi,
  getExchangeDirectionUi,
  type ExchangeDirection,
} from './ui'

describe('exchange ui helpers', () => {
  it('describes the current swap direction explicitly', () => {
    expect(getExchangeDirectionUi('vnd_to_usdt')).toEqual({
      fromAssetCode: 'VND',
      summaryLabel: 'VND -> USDT',
      toAssetCode: 'USDT',
    })

    expect(getExchangeDirectionUi('usdt_to_vnd')).toEqual({
      fromAssetCode: 'USDT',
      summaryLabel: 'USDT -> VND',
      toAssetCode: 'VND',
    })
  })

  it('keeps asset tones fixed by asset code instead of position', () => {
    expect(getExchangeAssetTone('VND')).toBe('blue')
    expect(getExchangeAssetTone('USDT')).toBe('green')
  })

  it('accepts the two supported exchange directions only', () => {
    const directions: ExchangeDirection[] = ['vnd_to_usdt', 'usdt_to_vnd']

    expect(directions.map(getExchangeDirectionUi)).toHaveLength(2)
  })

  it('builds the top balance-card swap layout from the current direction', () => {
    expect(getExchangeBalanceCardUi('vnd_to_usdt')).toEqual({
      directionLabel: 'VND -> USDT',
      leftAssetCode: 'VND',
      rightAssetCode: 'USDT',
    })

    expect(getExchangeBalanceCardUi('usdt_to_vnd')).toEqual({
      directionLabel: 'USDT -> VND',
      leftAssetCode: 'USDT',
      rightAssetCode: 'VND',
    })
  })
})
