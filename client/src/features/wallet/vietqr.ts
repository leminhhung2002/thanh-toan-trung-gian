type VietQrImageInput = {
  accountName: string
  accountNumber: string
  amount?: string
  bankCode: string
  transferContent?: string
}

export function buildVietQrImageUrl({
  accountName,
  accountNumber,
  amount,
  bankCode,
  transferContent,
}: VietQrImageInput) {
  const queryParts = [
    `accountName=${encodeURIComponent(accountName.trim())}`,
  ]

  const normalizedTransferContent = transferContent?.trim()
  if (normalizedTransferContent) {
    queryParts.push(`addInfo=${encodeURIComponent(normalizedTransferContent)}`)
  }

  const normalizedAmount = amount?.trim()
  if (normalizedAmount) {
    queryParts.push(`amount=${encodeURIComponent(normalizedAmount)}`)
  }

  return `https://img.vietqr.io/image/${bankCode.trim()}-${accountNumber.trim()}-compact2.png?${queryParts.join('&')}`
}
