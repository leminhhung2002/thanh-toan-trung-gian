import Big from 'big.js'

export function formatVnd(value: string | number) {
  return Number(value || 0).toLocaleString('vi-VN', {
    minimumFractionDigits: 0,
  })
}

export function formatUsdt(value: string | number, maximumFractionDigits = 2) {
  const rounded = new Big(String(value || 0)).round(maximumFractionDigits, Big.roundDown)

  return Number(rounded.toFixed(maximumFractionDigits)).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })
}
