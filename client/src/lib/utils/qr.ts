import QRCode from 'qrcode'

export async function createQrDataUrl(
  value: string,
  options?: {
    width?: number
  },
) {
  return QRCode.toDataURL(value, {
    margin: 1,
    width: options?.width ?? 220,
  })
}
