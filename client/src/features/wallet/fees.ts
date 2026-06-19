import Big from 'big.js'
import type { FinancialSettings } from '#/lib/types'

export function formatBpsPercent(feeBps: number) {
  const percent = feeBps / 100

  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(2)}%`
}

export function calculateFeePreview(
  amount: string,
  feeBps: number,
  assetCode: 'USDT' | 'VND',
) {
  const normalizedAmount = amount.trim()
  const precision = assetCode === 'VND' ? 0 : 2
  const feeRoundingMode = Big.roundUp

  if (!normalizedAmount) {
    return {
      feeAmount: 0,
      netReceive: 0,
      totalDebit: 0,
    }
  }

  let grossAmount: Big

  try {
    grossAmount = new Big(normalizedAmount)
  } catch {
    return {
      feeAmount: 0,
      netReceive: 0,
      totalDebit: 0,
    }
  }

  if (grossAmount.lte(0)) {
    return {
      feeAmount: 0,
      netReceive: 0,
      totalDebit: 0,
    }
  }

  const totalDebit = grossAmount.round(precision, Big.roundDown)
  const feeAmount = totalDebit.times(feeBps).div(10000).round(precision, feeRoundingMode)
  const netReceive = totalDebit.minus(feeAmount).round(precision, Big.roundDown)

  return {
    feeAmount: Number(feeAmount.toFixed(precision)),
    netReceive: Number(netReceive.toFixed(precision)),
    totalDebit: Number(totalDebit.toFixed(precision)),
  }
}

export function getFinancialSettingsGate(input: {
  context: 'exchange' | 'withdrawal'
  isError: boolean
  isPending: boolean
  settings?: FinancialSettings
}) {
  if (input.isPending) {
    return {
      isReady: false,
      message:
        input.context === 'exchange'
          ? 'Đang tải cấu hình tỷ giá đổi tiền...'
          : 'Đang tải cấu hình phí rút tiền...',
    }
  }

  if (input.isError || !input.settings) {
    return {
      isReady: false,
      message:
        input.context === 'exchange'
          ? 'Không thể tải cấu hình tỷ giá đổi tiền. Vui lòng thử lại sau.'
          : 'Không thể tải cấu hình phí rút tiền. Vui lòng thử lại sau.',
    }
  }

  return {
    isReady: true,
    message: '',
  }
}
