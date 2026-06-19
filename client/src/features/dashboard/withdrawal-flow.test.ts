import { describe, expect, it } from 'vitest'

import {
  buildWithdrawalDestinationDetails,
  createDashboardWithdrawalState,
  getWithdrawalMinimumRequiredMessage,
  validateWithdrawalCurrentPassword,
  validateWithdrawalAmount,
  validateWithdrawalNetReceive,
} from './withdrawal-flow'

describe('dashboard withdrawal flow helpers', () => {
  it('boots the VND withdrawal tab with the dashboard defaults', () => {
    expect(createDashboardWithdrawalState('alice')).toEqual({
      accountName: 'alice',
      accountNumber: '',
      amount: '25000',
      bankName: '',
      network: 'BEP20',
      tab: 'vnd',
      walletAddress: '',
    })
  })

  it('builds bank-transfer destination details only when all fields are present', () => {
    expect(
      buildWithdrawalDestinationDetails({
        accountName: 'Alice',
        accountNumber: '123',
        bankName: 'VCB',
        network: 'BEP20',
        tab: 'vnd',
        walletAddress: '',
      }),
    ).toEqual({
      destinationDetails: {
        accountName: 'Alice',
        accountNumber: '123',
        bankName: 'VCB',
        method: 'bank_transfer',
      },
      error: null,
    })
  })

  it('builds network-specific destination details for USDT withdrawals', () => {
    expect(
      buildWithdrawalDestinationDetails({
        accountName: '',
        accountNumber: '',
        bankName: '',
        network: 'BEP20',
        tab: 'usdt',
        walletAddress: '0xabc',
      }),
    ).toEqual({
      destinationDetails: {
        method: 'bep20',
        network: 'BEP20',
        walletAddress: '0xabc',
      },
      error: null,
    })

    expect(
      buildWithdrawalDestinationDetails({
        accountName: '',
        accountNumber: '',
        bankName: '',
        network: 'TRC20',
        tab: 'usdt',
        walletAddress: 'TXYZ',
      }),
    ).toEqual({
      destinationDetails: {
        method: 'trc20',
        network: 'TRC20',
        walletAddress: 'TXYZ',
      },
      error: null,
    })
  })

  it('requires a positive withdrawal amount', () => {
    expect(validateWithdrawalAmount('')).toBe('Vui lòng nhập số tiền rút hợp lệ')
    expect(validateWithdrawalAmount('1')).toBeNull()
  })

  it('rejects gross amounts that leave no money after fees', () => {
    expect(
      validateWithdrawalNetReceive({
        assetCode: 'VND',
        feeAmount: 1000,
        netReceive: 0,
      }),
    ).toBe('Số tiền rút phải lớn hơn phí giao dịch để nhận được tiền.')

    expect(
      validateWithdrawalNetReceive({
        assetCode: 'USDT',
        feeAmount: 0.5,
        netReceive: 0.25,
      }),
    ).toBeNull()
  })

  it('requires the current password before submitting a withdrawal', () => {
    expect(validateWithdrawalCurrentPassword('')).toBe(
      'Vui lòng nhập mật khẩu hiện tại để xác nhận rút tiền.',
    )
    expect(validateWithdrawalCurrentPassword(' Secret123! ')).toBeNull()
  })

  it('builds a minimum-balance warning when total debit exceeds available balance', () => {
    expect(
      getWithdrawalMinimumRequiredMessage({
        assetCode: 'VND',
        availableBalance: 100000,
        netReceive: 90000,
        totalDebit: 110000,
      }),
    ).toBe('90.000 VND thì cần ít nhất 110.000 VND')

    expect(
      getWithdrawalMinimumRequiredMessage({
        assetCode: 'USDT',
        availableBalance: 9.5,
        netReceive: 9.5,
        totalDebit: 10.5,
      }),
    ).toBe('9.50 USDT thì cần ít nhất 10.50 USDT')
  })

  it('returns null when the available balance is enough or preview values are invalid', () => {
    expect(
      getWithdrawalMinimumRequiredMessage({
        assetCode: 'VND',
        availableBalance: 110000,
        netReceive: 100000,
        totalDebit: 110000,
      }),
    ).toBeNull()

    expect(
      getWithdrawalMinimumRequiredMessage({
        assetCode: 'VND',
        availableBalance: 0,
        netReceive: 0,
        totalDebit: 0,
      }),
    ).toBeNull()
  })
})
