import { describe, expect, it } from 'vitest'

import {
  canCreateDashboardDepositReservation,
  canEditDashboardDepositAmount,
  createDashboardDepositState,
  getDashboardDepositLimitMessage,
  getDashboardDepositPrimaryActionLabel,
  getDashboardDepositAmountValue,
  getDashboardDepositStep,
  validateDashboardDepositAmount,
} from './deposit-flow'

describe('dashboard deposit flow helpers', () => {
  it('boots the VND tab with the default amount used by the dashboard', () => {
    expect(createDashboardDepositState()).toEqual({
      amount: '10000',
      error: '',
      step: 'entry',
      tab: 'vnd',
    })
  })

  it('opens the payment step immediately only when VND has an active QR reservation', () => {
    expect(
      getDashboardDepositStep({
        currentStep: 'entry',
        hasActiveReservation: true,
        tab: 'vnd',
      }),
    ).toBe('payment')

    expect(
      getDashboardDepositStep({
        currentStep: 'entry',
        hasActiveReservation: false,
        tab: 'vnd',
      }),
    ).toBe('entry')
  })

  it('keeps the USDT flow on the chosen step without backend reservation state', () => {
    expect(
      getDashboardDepositStep({
        currentStep: 'entry',
        hasActiveReservation: true,
        tab: 'usdt',
      }),
    ).toBe('entry')

    expect(
      getDashboardDepositStep({
        currentStep: 'payment',
        hasActiveReservation: false,
        tab: 'usdt',
      }),
    ).toBe('payment')
  })

  it('prefers the active reservation amount when the VND flow is locked to a reservation', () => {
    expect(
      getDashboardDepositAmountValue({
        currentReservationAmount: '55000',
        depositAmount: '10000',
        hasCurrentReservation: true,
        tab: 'vnd',
      }),
    ).toBe('55000')
  })

  it('requires a positive amount before either deposit flow can continue', () => {
    expect(validateDashboardDepositAmount('0')).toBe('Vui lòng nhập số tiền hợp lệ')
    expect(validateDashboardDepositAmount('15000')).toBeNull()
  })

  it('blocks VND deposits above 20 million and guides users to support for a private account', () => {
    expect(validateDashboardDepositAmount('20000000')).toBeNull()
    expect(validateDashboardDepositAmount('20000001')).toBe(
      'Số tiền trên 20.000.000 VND, vui lòng liên hệ hỗ trợ để được cấp tài khoản riêng.',
    )
  })

  it('locks the amount input only when VND already has an active QR reservation', () => {
    expect(
      canEditDashboardDepositAmount({
        hasActiveReservation: true,
        tab: 'vnd',
      }),
    ).toBe(false)

    expect(
      canEditDashboardDepositAmount({
        hasActiveReservation: false,
        tab: 'vnd',
      }),
    ).toBe(true)

    expect(
      canEditDashboardDepositAmount({
        hasActiveReservation: false,
        tab: 'vnd',
      }),
    ).toBe(true)

    expect(
      canEditDashboardDepositAmount({
        hasActiveReservation: true,
        tab: 'usdt',
      }),
    ).toBe(true)
  })

  it('chooses short, customer-facing CTA labels for the simplified flow', () => {
    expect(
      getDashboardDepositPrimaryActionLabel({
        hasActiveReservation: false,
        reservationExpired: false,
        step: 'entry',
        tab: 'usdt',
      }),
    ).toBe('Tiếp tục')

    expect(
      getDashboardDepositPrimaryActionLabel({
        hasActiveReservation: false,
        reservationExpired: false,
        step: 'payment',
        tab: 'usdt',
      }),
    ).toBe('Xác nhận thanh toán')

    expect(
      getDashboardDepositPrimaryActionLabel({
        hasActiveReservation: true,
        reservationExpired: true,
        step: 'payment',
        tab: 'vnd',
      }),
    ).toBe('Lấy thông tin mới')

    expect(
      getDashboardDepositPrimaryActionLabel({
        hasActiveReservation: false,
        reservationExpired: false,
        step: 'payment',
        tab: 'vnd',
      }),
    ).toBe('Xác nhận thanh toán')
  })

  it('allows creating more VND requests only when there is no active QR and the pending-review limit is still below 10', () => {
    expect(
      canCreateDashboardDepositReservation({
        hasActiveReservation: false,
        pendingReviewCount: 0,
      }),
    ).toBe(true)

    expect(
      canCreateDashboardDepositReservation({
        hasActiveReservation: false,
        pendingReviewCount: 9,
      }),
    ).toBe(true)

    expect(
      canCreateDashboardDepositReservation({
        hasActiveReservation: true,
        pendingReviewCount: 0,
      }),
    ).toBe(false)

    expect(
      canCreateDashboardDepositReservation({
        hasActiveReservation: false,
        pendingReviewCount: 10,
      }),
    ).toBe(false)
  })

  it('returns a clear limit message once the pending-review request limit is reached', () => {
    expect(
      getDashboardDepositLimitMessage({
        pendingReviewCount: 9,
      }),
    ).toBeNull()

    expect(
      getDashboardDepositLimitMessage({
        pendingReviewCount: 10,
      }),
    ).toBe(
      'Bạn đã có 10 yêu cầu nạp tiền đang chờ duyệt. Vui lòng chờ xử lý trước khi tạo yêu cầu mới.',
    )
  })
})
