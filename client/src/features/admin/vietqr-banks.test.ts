import { describe, expect, it, vi } from 'vitest'

import { findVietQrBank, listVietQrBanks } from './vietqr-banks'

describe('listVietQrBanks', () => {
  it('returns only VietQR banks with transfer support and sorts them by short name', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            bin: '970416',
            code: 'ACB',
            id: 2,
            name: 'Ngân hàng TMCP Á Châu',
            shortName: 'ACB',
            transferSupported: 1,
          },
          {
            bin: '970436',
            code: 'VCB',
            id: 43,
            name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
            shortName: 'Vietcombank',
            transferSupported: 1,
          },
          {
            bin: '999999',
            code: 'LEGACY',
            id: 999,
            name: 'Legacy Bank',
            shortName: 'Legacy',
            transferSupported: 0,
          },
          {
            bin: '970422',
            code: 'MB',
            id: 21,
            name: 'Ngân hàng TMCP Quân đội',
            shortName: 'MBBank',
          },
          {
            bin: '970448',
            code: 'OCB',
            id: 26,
            name: 'Ngân hàng TMCP Phương Đông',
            transferSupported: 1,
          },
        ],
      }),
    })

    const banks = await listVietQrBanks(fetchImpl as typeof fetch)

    expect(banks.map((bank) => bank.shortName)).toEqual(['ACB', 'Vietcombank'])
    expect(banks.every((bank) => bank.transferSupported === 1)).toBe(true)
  })

  it('falls back to the local snapshot when VietQR fails', async () => {
    const banks = await listVietQrBanks(
      vi.fn().mockRejectedValue(new Error('network error')) as typeof fetch,
    )

    expect(banks.length).toBeGreaterThan(6)
    expect(banks.every((bank) => bank.transferSupported === 1)).toBe(true)
    expect(findVietQrBank(banks, '970436')?.shortName).toBe('Vietcombank')
  })
})

describe('findVietQrBank', () => {
  const banks = [
    {
      bin: '970436',
      code: 'VCB',
      id: 43,
      name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
      shortName: 'Vietcombank',
      transferSupported: 1,
    },
  ]

  it('finds a bank by bin', () => {
    expect(findVietQrBank(banks, '970436')?.shortName).toBe('Vietcombank')
  })

  it('finds a bank by code', () => {
    expect(findVietQrBank(banks, 'VCB')?.shortName).toBe('Vietcombank')
  })
})
