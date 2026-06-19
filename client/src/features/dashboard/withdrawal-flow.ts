import type { WithdrawalDestinationDetails } from '#/lib/types'
import { formatUsdt, formatVnd } from '#/lib/utils/format'

function formatWithdrawalUsdt(value: number) {
  return Number(value || 0).toLocaleString('en-US', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 6,
  })
}

export function createDashboardWithdrawalState(displayName: string) {
  return {
    accountName: displayName,
    accountNumber: '',
    amount: '25000',
    bankName: '',
    network: 'BEP20',
    tab: 'vnd' as const,
    walletAddress: '',
  }
}

export function validateWithdrawalAmount(amount: string) {
  const normalizedAmount = amount.trim()

  if (!normalizedAmount || Number(normalizedAmount) <= 0) {
    return 'Vui lòng nhập số tiền rút hợp lệ'
  }

  return null
}

export function validateWithdrawalNetReceive(input: {
  assetCode: 'USDT' | 'VND'
  feeAmount: number
  netReceive: number
}) {
  if (
    !Number.isFinite(input.netReceive) ||
    !Number.isFinite(input.feeAmount) ||
    input.netReceive <= 0
  ) {
    return 'Số tiền rút phải lớn hơn phí giao dịch để nhận được tiền.'
  }

  return null
}

export function validateWithdrawalCurrentPassword(currentPassword: string) {
  if (!currentPassword.trim()) {
    return 'Vui lòng nhập mật khẩu hiện tại để xác nhận rút tiền.'
  }

  return null
}

export function buildWithdrawalDestinationDetails(input: {
  accountName: string
  accountNumber: string
  bankName: string
  network: string
  tab: 'usdt' | 'vnd'
  walletAddress: string
}): {
  destinationDetails: WithdrawalDestinationDetails | null
  error: string | null
} {
  if (input.tab === 'vnd') {
    const bankName = input.bankName.trim()
    const accountNumber = input.accountNumber.trim()
    const accountName = input.accountName.trim()

    if (!bankName || !accountNumber || !accountName) {
      return {
        destinationDetails: null,
        error: 'Vui lòng điền đủ thông tin tài khoản ngân hàng',
      }
    }

    return {
      destinationDetails: {
        accountName,
        accountNumber,
        bankName,
        method: 'bank_transfer',
      },
      error: null,
    }
  }

  const walletAddress = input.walletAddress.trim()
  const network = input.network.trim() || 'BEP20'
  const method = network.toUpperCase() === 'TRC20' ? 'trc20' : 'bep20'

  if (!walletAddress) {
    return {
      destinationDetails: null,
      error: 'Vui lòng nhập địa chỉ ví USDT',
    }
  }

  return {
    destinationDetails: {
      method,
      network,
      walletAddress,
    },
    error: null,
  }
}

export function getWithdrawalMinimumRequiredMessage(input: {
  assetCode: 'USDT' | 'VND'
  availableBalance: number
  netReceive: number
  totalDebit: number
}) {
  if (
    !Number.isFinite(input.totalDebit) ||
    !Number.isFinite(input.netReceive) ||
    input.netReceive <= 0 ||
    input.totalDebit <= 0 ||
    input.totalDebit <= input.availableBalance
  ) {
    return null
  }

  const formatAmount = (value: number) =>
    input.assetCode === 'VND'
      ? `${formatVnd(value)} VND`
      : `${formatUsdt(value)} USDT`

  return `${formatAmount(input.netReceive)} thì cần ít nhất ${formatAmount(input.totalDebit)}`
}
