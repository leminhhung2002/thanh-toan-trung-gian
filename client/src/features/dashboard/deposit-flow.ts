type DashboardDepositTab = 'usdt' | 'vnd'
type DashboardDepositStep = 'entry' | 'payment'
const MAX_PENDING_REVIEW_BILLS = 10
const MAX_VND_DEPOSIT_AMOUNT = 20_000_000

export function createDashboardDepositState() {
  return {
    amount: '10000',
    error: '',
    step: 'entry' as const,
    tab: 'vnd' as const,
  }
}

export function validateDashboardDepositAmount(amount: string) {
  const normalizedAmount = amount.trim()
  const numericAmount = Number(normalizedAmount)

  if (!normalizedAmount || numericAmount <= 0) {
    return 'Vui lòng nhập số tiền hợp lệ'
  }

  if (numericAmount > MAX_VND_DEPOSIT_AMOUNT) {
    return 'Số tiền trên 20.000.000 VND, vui lòng liên hệ hỗ trợ để được cấp tài khoản riêng.'
  }

  return null
}

export function getDashboardDepositAmountValue(input: {
  currentReservationAmount: string
  depositAmount: string
  hasCurrentReservation: boolean
  tab: DashboardDepositTab
}) {
  if (input.tab === 'vnd' && input.hasCurrentReservation) {
    return input.currentReservationAmount
  }

  return input.depositAmount
}

export function getDashboardDepositStep(input: {
  currentStep: DashboardDepositStep
  hasActiveReservation: boolean
  tab: DashboardDepositTab
}) {
  if (input.tab === 'vnd' && input.hasActiveReservation) {
    return 'payment'
  }

  return input.currentStep
}

export function canEditDashboardDepositAmount(input: {
  hasActiveReservation: boolean
  tab: DashboardDepositTab
}) {
  if (input.tab !== 'vnd') {
    return true
  }

  return !input.hasActiveReservation
}

export function getDashboardDepositPrimaryActionLabel(input: {
  hasActiveReservation: boolean
  reservationExpired: boolean
  step: DashboardDepositStep
  tab: DashboardDepositTab
}) {
  if (input.step === 'entry') {
    return 'Tiếp tục'
  }

  if (input.tab === 'usdt') {
    return 'Xác nhận thanh toán'
  }

  if (input.hasActiveReservation && input.reservationExpired) {
    return 'Lấy thông tin mới'
  }

  return 'Xác nhận thanh toán'
}

export function canCreateDashboardDepositReservation(input: {
  hasActiveReservation: boolean
  pendingReviewCount: number
}) {
  return !input.hasActiveReservation && input.pendingReviewCount < MAX_PENDING_REVIEW_BILLS
}

export function getDashboardDepositLimitMessage(input: {
  pendingReviewCount: number
}) {
  if (input.pendingReviewCount < MAX_PENDING_REVIEW_BILLS) {
    return null
  }

  return 'Bạn đã có 10 yêu cầu nạp tiền đang chờ duyệt. Vui lòng chờ xử lý trước khi tạo yêu cầu mới.'
}
