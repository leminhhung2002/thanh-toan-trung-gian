import type { VietQrBankOption } from '#/lib/types'

type VietQrBanksResponse = {
  data?: Array<{
    bin?: string
    code?: string
    id?: number
    logo?: string
    name?: string
    shortName?: string
    transferSupported?: number
  }>
}

const FALLBACK_BANKS: VietQrBankOption[] = [
  {
    bin: '970425',
    code: 'ABB',
    id: 1,
    logo: 'https://cdn.vietqr.io/img/ABB.png',
    name: 'Ngân hàng TMCP An Bình',
    shortName: 'ABBANK',
    transferSupported: 1,
  },
  {
    bin: '970416',
    code: 'ACB',
    id: 2,
    logo: 'https://cdn.vietqr.io/img/ACB.png',
    name: 'Ngân hàng TMCP Á Châu',
    shortName: 'ACB',
    transferSupported: 1,
  },
  {
    bin: '970405',
    code: 'VBA',
    id: 42,
    logo: 'https://cdn.vietqr.io/img/VBA.png',
    name: 'Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam',
    shortName: 'Agribank',
    transferSupported: 1,
  },
  {
    bin: '970409',
    code: 'BAB',
    id: 3,
    logo: 'https://cdn.vietqr.io/img/BAB.png',
    name: 'Ngân hàng TMCP Bắc Á',
    shortName: 'BacABank',
    transferSupported: 1,
  },
  {
    bin: '970438',
    code: 'BVB',
    id: 5,
    logo: 'https://cdn.vietqr.io/img/BVB.png',
    name: 'Ngân hàng TMCP Bảo Việt',
    shortName: 'BaoVietBank',
    transferSupported: 1,
  },
  {
    bin: '970418',
    code: 'BIDV',
    id: 4,
    logo: 'https://cdn.vietqr.io/img/BIDV.png',
    name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam',
    shortName: 'BIDV',
    transferSupported: 1,
  },
  {
    bin: '546034',
    code: 'CAKE',
    id: 53,
    logo: 'https://cdn.vietqr.io/img/CAKE.png',
    name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số CAKE by VPBank',
    shortName: 'CAKE',
    transferSupported: 1,
  },
  {
    bin: '422589',
    code: 'CIMB',
    id: 7,
    logo: 'https://cdn.vietqr.io/img/CIMB.png',
    name: 'Ngân hàng TNHH MTV CIMB Việt Nam',
    shortName: 'CIMB',
    transferSupported: 1,
  },
  {
    bin: '970446',
    code: 'COOPBANK',
    id: 52,
    logo: 'https://cdn.vietqr.io/img/COOPBANK.png',
    name: 'Ngân hàng Hợp tác xã Việt Nam',
    shortName: 'COOPBANK',
    transferSupported: 1,
  },
  {
    bin: '970431',
    code: 'EIB',
    id: 10,
    logo: 'https://cdn.vietqr.io/img/EIB.png',
    name: 'Ngân hàng TMCP Xuất Nhập khẩu Việt Nam',
    shortName: 'Eximbank',
    transferSupported: 1,
  },
  {
    bin: '970437',
    code: 'HDB',
    id: 12,
    logo: 'https://cdn.vietqr.io/img/HDB.png',
    name: 'Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh',
    shortName: 'HDBank',
    transferSupported: 1,
  },
  {
    bin: '668888',
    code: 'KBank',
    id: 55,
    logo: 'https://cdn.vietqr.io/img/KBANK.png',
    name: 'Ngân hàng Đại chúng TNHH Kasikornbank',
    shortName: 'KBank',
    transferSupported: 1,
  },
  {
    bin: '970452',
    code: 'KLB',
    id: 19,
    logo: 'https://cdn.vietqr.io/img/KLB.png',
    name: 'Ngân hàng TMCP Kiên Long',
    shortName: 'KienLongBank',
    transferSupported: 1,
  },
  {
    bin: '970449',
    code: 'LPB',
    id: 20,
    logo: 'https://cdn.vietqr.io/img/LPB.png',
    name: 'Ngân hàng TMCP Lộc Phát Việt Nam',
    shortName: 'LPBank',
    transferSupported: 1,
  },
  {
    bin: '970422',
    code: 'MB',
    id: 21,
    logo: 'https://cdn.vietqr.io/img/MB.png',
    name: 'Ngân hàng TMCP Quân đội',
    shortName: 'MBBank',
    transferSupported: 1,
  },
  {
    bin: '970414',
    code: 'MBV',
    id: 27,
    logo: 'https://cdn.vietqr.io/img/MBV.png',
    name: 'Ngân hàng TNHH MTV Việt Nam Hiện Đại',
    shortName: 'MBV',
    transferSupported: 1,
  },
  {
    bin: '971025',
    code: 'momo',
    id: 65,
    logo: 'https://cdn.vietqr.io/img/momo.png',
    name: 'CTCP Dịch Vụ Di Động Trực Tuyến',
    shortName: 'MoMo',
    transferSupported: 1,
  },
  {
    bin: '970426',
    code: 'MSB',
    id: 22,
    logo: 'https://cdn.vietqr.io/img/MSB.png',
    name: 'Ngân hàng TMCP Hàng Hải Việt Nam',
    shortName: 'MSB',
    transferSupported: 1,
  },
  {
    bin: '970428',
    code: 'NAB',
    id: 23,
    logo: 'https://cdn.vietqr.io/img/NAB.png',
    name: 'Ngân hàng TMCP Nam Á',
    shortName: 'NamABank',
    transferSupported: 1,
  },
  {
    bin: '970419',
    code: 'NCB',
    id: 24,
    logo: 'https://cdn.vietqr.io/img/NCB.png',
    name: 'Ngân hàng TMCP Quốc Dân',
    shortName: 'NCB',
    transferSupported: 1,
  },
  {
    bin: '970448',
    code: 'OCB',
    id: 26,
    logo: 'https://cdn.vietqr.io/img/OCB.png',
    name: 'Ngân hàng TMCP Phương Đông',
    shortName: 'OCB',
    transferSupported: 1,
  },
  {
    bin: '970430',
    code: 'PGB',
    id: 29,
    logo: 'https://cdn.vietqr.io/img/PGB.png',
    name: 'Ngân hàng TMCP Thịnh vượng và Phát triển',
    shortName: 'PGBank',
    transferSupported: 1,
  },
  {
    bin: '970412',
    code: 'PVCB',
    id: 30,
    logo: 'https://cdn.vietqr.io/img/PVCB.png',
    name: 'Ngân hàng TMCP Đại Chúng Việt Nam',
    shortName: 'PVcomBank',
    transferSupported: 1,
  },
  {
    bin: '971133',
    code: 'PVDB',
    id: 64,
    logo: 'https://cdn.vietqr.io/img/PVCB.png',
    name: 'Ngân hàng TMCP Đại Chúng Việt Nam Ngân hàng số',
    shortName: 'PVcomBank Pay',
    transferSupported: 1,
  },
  {
    bin: '970403',
    code: 'STB',
    id: 36,
    logo: 'https://cdn.vietqr.io/img/STB.png',
    name: 'Ngân hàng TMCP Sài Gòn Thương Tín',
    shortName: 'Sacombank',
    transferSupported: 1,
  },
  {
    bin: '970400',
    code: 'SGICB',
    id: 34,
    logo: 'https://cdn.vietqr.io/img/SGICB.png',
    name: 'Ngân hàng TMCP Sài Gòn Công Thương',
    shortName: 'SaigonBank',
    transferSupported: 1,
  },
  {
    bin: '970429',
    code: 'SCB',
    id: 31,
    logo: 'https://cdn.vietqr.io/img/SCB.png',
    name: 'Ngân hàng TMCP Sài Gòn',
    shortName: 'SCB',
    transferSupported: 1,
  },
  {
    bin: '970440',
    code: 'SEAB',
    id: 33,
    logo: 'https://cdn.vietqr.io/img/SEAB.png',
    name: 'Ngân hàng TMCP Đông Nam Á',
    shortName: 'SeABank',
    transferSupported: 1,
  },
  {
    bin: '970443',
    code: 'SHB',
    id: 35,
    logo: 'https://cdn.vietqr.io/img/SHB.png',
    name: 'Ngân hàng TMCP Sài Gòn - Hà Nội',
    shortName: 'SHB',
    transferSupported: 1,
  },
  {
    bin: '970424',
    code: 'SHBVN',
    id: 37,
    logo: 'https://cdn.vietqr.io/img/SHBVN.png',
    name: 'Ngân hàng TNHH MTV Shinhan Việt Nam',
    shortName: 'ShinhanBank',
    transferSupported: 1,
  },
  {
    bin: '970407',
    code: 'TCB',
    id: 38,
    logo: 'https://cdn.vietqr.io/img/TCB.png',
    name: 'Ngân hàng TMCP Kỹ thương Việt Nam',
    shortName: 'Techcombank',
    transferSupported: 1,
  },
  {
    bin: '963388',
    code: 'TIMO',
    id: 58,
    logo: 'https://vietqr.net/portal-service/resources/icons/TIMO.png',
    name: 'Ngân hàng số Timo by Ban Viet Bank (Timo by Ban Viet Bank)',
    shortName: 'Timo',
    transferSupported: 1,
  },
  {
    bin: '970423',
    code: 'TPB',
    id: 39,
    logo: 'https://cdn.vietqr.io/img/TPB.png',
    name: 'Ngân hàng TMCP Tiên Phong',
    shortName: 'TPBank',
    transferSupported: 1,
  },
  {
    bin: '546035',
    code: 'Ubank',
    id: 54,
    logo: 'https://cdn.vietqr.io/img/UBANK.png',
    name: 'TMCP Việt Nam Thịnh Vượng - Ngân hàng số Ubank by VPBank',
    shortName: 'Ubank',
    transferSupported: 1,
  },
  {
    bin: '970441',
    code: 'VIB',
    id: 45,
    logo: 'https://cdn.vietqr.io/img/VIB.png',
    name: 'Ngân hàng TMCP Quốc tế Việt Nam',
    shortName: 'VIB',
    transferSupported: 1,
  },
  {
    bin: '970427',
    code: 'VAB',
    id: 41,
    logo: 'https://cdn.vietqr.io/img/VAB.png',
    name: 'Ngân hàng TMCP Việt Á',
    shortName: 'VietABank',
    transferSupported: 1,
  },
  {
    bin: '970433',
    code: 'VIETBANK',
    id: 46,
    logo: 'https://cdn.vietqr.io/img/VIETBANK.png',
    name: 'Ngân hàng TMCP Việt Nam Thương Tín',
    shortName: 'VietBank',
    transferSupported: 1,
  },
  {
    bin: '970454',
    code: 'VCCB',
    id: 44,
    logo: 'https://cdn.vietqr.io/img/VCCB.png',
    name: 'Ngân hàng TMCP Bản Việt',
    shortName: 'VietCapitalBank',
    transferSupported: 1,
  },
  {
    bin: '970436',
    code: 'VCB',
    id: 43,
    logo: 'https://cdn.vietqr.io/img/VCB.png',
    name: 'Ngân hàng TMCP Ngoại Thương Việt Nam',
    shortName: 'Vietcombank',
    transferSupported: 1,
  },
  {
    bin: '970415',
    code: 'ICB',
    id: 17,
    logo: 'https://cdn.vietqr.io/img/ICB.png',
    name: 'Ngân hàng TMCP Công thương Việt Nam',
    shortName: 'VietinBank',
    transferSupported: 1,
  },
  {
    bin: '970432',
    code: 'VPB',
    id: 47,
    logo: 'https://cdn.vietqr.io/img/VPB.png',
    name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng',
    shortName: 'VPBank',
    transferSupported: 1,
  },
  {
    bin: '970457',
    code: 'WVN',
    id: 49,
    logo: 'https://cdn.vietqr.io/img/WVN.png',
    name: 'Ngân hàng TNHH MTV Woori Việt Nam',
    shortName: 'Woori',
    transferSupported: 1,
  },
]

function toVietQrBankOption(
  item: NonNullable<VietQrBanksResponse['data']>[number],
) {
  if (
    !item?.bin ||
    !item.code ||
    !item.name ||
    !item.shortName ||
    item.transferSupported !== 1
  ) {
    return null
  }

  return {
    bin: item.bin,
    code: item.code,
    id: item.id ?? 0,
    logo: item.logo,
    name: item.name,
    shortName: item.shortName,
    transferSupported: item.transferSupported,
  } satisfies VietQrBankOption
}

export async function listVietQrBanks(fetchImpl: typeof fetch = fetch) {
  try {
    const response = await fetchImpl('https://api.vietqr.io/v2/banks', {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error('Failed to load VietQR bank list')
    }

    const payload = (await response.json()) as VietQrBanksResponse
    const banks = (payload.data ?? [])
      .map(toVietQrBankOption)
      .filter((item) => item !== null)
      .sort((left, right) => left.shortName.localeCompare(right.shortName, 'vi'))

    if (banks.length > 0) {
      return banks
    }
  } catch {}

  return FALLBACK_BANKS
}

export function findVietQrBank(
  banks: VietQrBankOption[],
  bankCode: string,
) {
  return banks.find((bank) => bank.bin === bankCode || bank.code === bankCode)
}

export function getBankOptionsForForm(
  banks: VietQrBankOption[],
  editingBank:
    | {
        bankCode: string
        bankName: string
      }
    | null
    | undefined,
) {
  if (!editingBank?.bankCode.trim()) {
    return banks
  }

  const existingBank = findVietQrBank(banks, editingBank.bankCode)

  if (existingBank) {
    return banks
  }

  return [
    {
      bin: editingBank.bankCode.trim(),
      code: editingBank.bankCode.trim(),
      id: 0,
      name: editingBank.bankName.trim() || editingBank.bankCode.trim(),
      shortName: editingBank.bankName.trim() || editingBank.bankCode.trim(),
      transferSupported: 0,
    },
    ...banks,
  ]
}
