import { describe, expect, it } from 'vitest'

import { buildVietQrImageUrl } from './vietqr'

describe('buildVietQrImageUrl', () => {
  it('builds a VietQR image url from the selected bank account payload', () => {
    const url = buildVietQrImageUrl({
      accountName: 'NGAN LUONG',
      accountNumber: '123456789',
      amount: '150000',
      bankCode: '970436',
      transferContent: 'walletuser',
    })

    expect(url).toBe(
      'https://img.vietqr.io/image/970436-123456789-compact2.png?accountName=NGAN%20LUONG&addInfo=walletuser&amount=150000',
    )
  })
})
