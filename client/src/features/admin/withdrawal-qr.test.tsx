// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VietQrBankOption, WithdrawalDestinationDetails } from '#/lib/types'
import {
  AdminWithdrawalQrCard,
  getAdminWithdrawalQrDescriptor,
} from './withdrawal-qr'

const qrUtilsMock = vi.hoisted(() => ({
  createQrDataUrl: vi.fn(),
}))

vi.mock('#/lib/utils/qr', () => ({
  createQrDataUrl: qrUtilsMock.createQrDataUrl,
}))

afterEach(() => {
  cleanup()
  qrUtilsMock.createQrDataUrl.mockReset()
})

const vietQrBanks: VietQrBankOption[] = [
  {
    bin: '970436',
    code: 'VCB',
    id: 1,
    logo: 'https://cdn.vietqr.io/img/VCB.png',
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    shortName: 'Vietcombank',
    transferSupported: 1,
  },
]

describe('getAdminWithdrawalQrDescriptor', () => {
  it('builds a VietQR image for VND withdrawals whose bank matches the VietQR list', () => {
    const descriptor = getAdminWithdrawalQrDescriptor({
      amount: '90000',
      bankOptions: vietQrBanks,
      destinationDetails: {
        accountName: 'NGUYEN VAN A',
        accountNumber: '0123456789',
        bankName: 'Vietcombank',
        method: 'bank_transfer',
      },
    })

    expect(descriptor).toEqual(
      expect.objectContaining({
        alt: 'VietQR nhận tiền',
        kind: 'remote-image',
      }),
    )
    expect(descriptor.kind === 'remote-image' ? descriptor.src : '').toContain(
      'https://img.vietqr.io/image/970436-0123456789-compact2.png',
    )
    expect(descriptor.kind === 'remote-image' ? descriptor.src : '').toContain(
      'amount=90000',
    )
  })

  it('returns a safe fallback when the VND bank cannot be mapped to VietQR', () => {
    expect(
      getAdminWithdrawalQrDescriptor({
        amount: '90000',
        bankOptions: vietQrBanks,
        destinationDetails: {
          accountName: 'NGUYEN VAN A',
          accountNumber: '0123456789',
          bankName: 'Ten ngan hang cu',
          method: 'bank_transfer',
        },
      }),
    ).toEqual({
      kind: 'unavailable',
      message: 'Không tạo được VietQR cho ngân hàng này.',
    })
  })

  it('returns an address-based QR descriptor for BEP20 withdrawals', () => {
    expect(
      getAdminWithdrawalQrDescriptor({
        amount: '3.25',
        bankOptions: vietQrBanks,
        destinationDetails: {
          method: 'bep20',
          network: 'BEP20',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        },
      }),
    ).toEqual({
      alt: 'QR địa chỉ ví',
      kind: 'local-address',
      value: '0x1234567890abcdef1234567890abcdef12345678',
    })
  })

  it('returns an address-based QR descriptor for TRC20 withdrawals', () => {
    expect(
      getAdminWithdrawalQrDescriptor({
        amount: '3.25',
        bankOptions: vietQrBanks,
        destinationDetails: {
          method: 'trc20',
          network: 'TRC20',
          walletAddress: 'TUZ8c6dD8b2n7dU6F2q7v4f4n8a9w3s5Vx',
        },
      }),
    ).toEqual({
      alt: 'QR địa chỉ ví',
      kind: 'local-address',
      value: 'TUZ8c6dD8b2n7dU6F2q7v4f4n8a9w3s5Vx',
    })
  })
})

describe('AdminWithdrawalQrCard', () => {
  it('renders a VietQR image for a mapped VND withdrawal', async () => {
    render(
      <AdminWithdrawalQrCard
        amount="90000"
        bankOptions={vietQrBanks}
        destinationDetails={{
          accountName: 'NGUYEN VAN A',
          accountNumber: '0123456789',
          bankName: 'Vietcombank',
          method: 'bank_transfer',
        }}
      />,
    )

    const qr = await screen.findByAltText('VietQR nhận tiền')
    expect(qr.getAttribute('src')).toContain('970436-0123456789-compact2.png')
    expect(qr.getAttribute('src')).toContain('amount=90000')
    expect(screen.getByText('QR nhận tiền')).toBeTruthy()
  })

  it('renders a local QR image for BEP20 withdrawals', async () => {
    qrUtilsMock.createQrDataUrl.mockResolvedValue('data:image/png;base64,bep20-qr')

    render(
      <AdminWithdrawalQrCard
        amount="3.25"
        bankOptions={vietQrBanks}
        destinationDetails={{
          method: 'bep20',
          network: 'BEP20',
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        }}
      />,
    )

    await waitFor(() => {
      expect(qrUtilsMock.createQrDataUrl).toHaveBeenCalledWith(
        '0x1234567890abcdef1234567890abcdef12345678',
        { width: 220 },
      )
    })
    const qr = await screen.findByAltText('QR địa chỉ ví')
    expect(qr.getAttribute('src')).toBe('data:image/png;base64,bep20-qr')
  })

  it('shows a fallback note instead of a QR for unmatched VND banks', () => {
    render(
      <AdminWithdrawalQrCard
        amount="90000"
        bankOptions={vietQrBanks}
        destinationDetails={{
          accountName: 'NGUYEN VAN A',
          accountNumber: '0123456789',
          bankName: 'Ngan hang khong map duoc',
          method: 'bank_transfer',
        }}
      />,
    )

    expect(screen.getByText('Không tạo được VietQR cho ngân hàng này.')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })
})
