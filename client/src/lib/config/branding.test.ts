import { describe, expect, it } from 'vitest'
import { brandConfig } from './branding'

describe('brandConfig', () => {
  it('describes the public-facing rebrand', () => {
    expect(brandConfig.appName).toBe('Tài khoản trung gian')
    expect(brandConfig.domain).toBe('tktrunggian.com')
    expect(brandConfig.logoSrc).toBe('/techpay.png')
    expect(brandConfig.registerTagline).toBe('Dịch vụ tài khoản trung gian trực tuyến')
  })
})
