import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  toDataURL: vi.fn(),
}))

vi.mock('qrcode', () => ({
  default: {
    toDataURL: mocks.toDataURL,
  },
}))

const { createQrDataUrl } = await import('./qr')

describe('createQrDataUrl', () => {
  beforeEach(() => {
    mocks.toDataURL.mockReset()
  })

  it('renders QR images locally with the shared defaults', async () => {
    mocks.toDataURL.mockResolvedValue('data:image/png;base64,abc123')

    const result = await createQrDataUrl('otpauth://totp/demo', { width: 220 })

    expect(result).toBe('data:image/png;base64,abc123')
    expect(mocks.toDataURL).toHaveBeenCalledWith('otpauth://totp/demo', {
      margin: 1,
      width: 220,
    })
  })
})
