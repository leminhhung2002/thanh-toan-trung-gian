import { useEffect, useMemo, useState } from 'react'
import { buildVietQrImageUrl } from '#/features/wallet/vietqr'
import type { VietQrBankOption, WithdrawalDestinationDetails } from '#/lib/types'
import { createQrDataUrl } from '#/lib/utils/qr'
import styles from '../../routes/admin.module.css'

type AdminWithdrawalQrDescriptor =
  | {
      alt: string
      kind: 'local-address'
      value: string
    }
  | {
      alt: string
      kind: 'remote-image'
      src: string
    }
  | {
      kind: 'none'
    }
  | {
      kind: 'unavailable'
      message: string
    }

function normalizeBankValue(value: string) {
  return value.trim().toLowerCase()
}

function findVietQrBankForWithdrawal(
  bankOptions: VietQrBankOption[],
  bankName: string,
) {
  const normalizedBankName = normalizeBankValue(bankName)

  if (!normalizedBankName) {
    return null
  }

  return (
    bankOptions.find((bank) => {
      const candidates = [bank.shortName, bank.name, bank.code, bank.bin]
        .filter(Boolean)
        .map((candidate) => normalizeBankValue(String(candidate)))

      return candidates.includes(normalizedBankName)
    }) ?? null
  )
}

export function getAdminWithdrawalQrDescriptor(input: {
  amount?: string | null
  bankOptions: VietQrBankOption[]
  destinationDetails: WithdrawalDestinationDetails | null | undefined
}): AdminWithdrawalQrDescriptor {
  const { amount, bankOptions, destinationDetails } = input

  if (!destinationDetails) {
    return { kind: 'none' }
  }

  if (destinationDetails.method === 'bank_transfer') {
    const bank = findVietQrBankForWithdrawal(bankOptions, destinationDetails.bankName)

    if (!bank) {
      return {
        kind: 'unavailable',
        message: 'Không tạo được VietQR cho ngân hàng này.',
      }
    }

    return {
      alt: 'VietQR nhận tiền',
      kind: 'remote-image',
      src: buildVietQrImageUrl({
        accountName: destinationDetails.accountName,
        accountNumber: destinationDetails.accountNumber,
        amount: amount ?? undefined,
        bankCode: bank.bin,
      }),
    }
  }

  if (
    destinationDetails.method === 'bep20'
    || destinationDetails.method === 'trc20'
  ) {
    return {
      alt: 'QR địa chỉ ví',
      kind: 'local-address',
      value: destinationDetails.walletAddress,
    }
  }

  return { kind: 'none' }
}

export function AdminWithdrawalQrCard({
  amount,
  bankOptions,
  destinationDetails,
}: {
  amount?: string | null
  bankOptions: VietQrBankOption[]
  destinationDetails: WithdrawalDestinationDetails | null | undefined
}) {
  const descriptor = useMemo(
    () => getAdminWithdrawalQrDescriptor({ amount, bankOptions, destinationDetails }),
    [amount, bankOptions, destinationDetails],
  )
  const [localQrSrc, setLocalQrSrc] = useState<string | null>(null)
  const [localQrError, setLocalQrError] = useState(false)

  useEffect(() => {
    let cancelled = false

    if (descriptor.kind !== 'local-address') {
      setLocalQrSrc(null)
      setLocalQrError(false)
      return () => {
        cancelled = true
      }
    }

    setLocalQrSrc(null)
    setLocalQrError(false)

    void createQrDataUrl(descriptor.value, { width: 220 })
      .then((result) => {
        if (!cancelled) {
          setLocalQrSrc(result)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocalQrError(true)
        }
      })

    return () => {
      cancelled = true
    }
  }, [descriptor])

  if (descriptor.kind === 'none') {
    return null
  }

  let content: JSX.Element

  if (descriptor.kind === 'remote-image') {
    content = (
      <img
        alt={descriptor.alt}
        className={styles.reviewQrImage}
        src={descriptor.src}
      />
    )
  } else if (descriptor.kind === 'unavailable') {
    content = <div className={styles.reviewQrFallback}>{descriptor.message}</div>
  } else if (localQrError) {
    content = (
      <div className={styles.reviewQrFallback}>
        Không tạo được QR cho địa chỉ ví này.
      </div>
    )
  } else if (!localQrSrc) {
    content = <div className={styles.reviewQrFallback}>Đang tạo QR...</div>
  } else {
    content = (
      <img
        alt={descriptor.alt}
        className={styles.reviewQrImage}
        src={localQrSrc}
      />
    )
  }

  return (
    <div className={styles.reviewQrCard}>
      <div className={styles.infoRowLabel}>QR nhận tiền</div>
      <div className={styles.reviewQrBody}>{content}</div>
    </div>
  )
}
