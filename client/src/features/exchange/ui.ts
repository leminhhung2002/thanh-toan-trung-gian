export type ExchangeDirection = 'usdt_to_vnd' | 'vnd_to_usdt'

export function getExchangeDirectionUi(direction: ExchangeDirection) {
  if (direction === 'vnd_to_usdt') {
    return {
      fromAssetCode: 'VND' as const,
      summaryLabel: 'VND -> USDT',
      toAssetCode: 'USDT' as const,
    }
  }

  return {
    fromAssetCode: 'USDT' as const,
    summaryLabel: 'USDT -> VND',
    toAssetCode: 'VND' as const,
  }
}

export function getExchangeAssetTone(assetCode: 'USDT' | 'VND') {
  return assetCode === 'VND' ? 'blue' : 'green'
}

export function getExchangeBalanceCardUi(direction: ExchangeDirection) {
  const directionUi = getExchangeDirectionUi(direction)

  return {
    directionLabel: directionUi.summaryLabel,
    leftAssetCode: directionUi.fromAssetCode,
    rightAssetCode: directionUi.toAssetCode,
  }
}
