import { describe, expect, it } from 'vitest'

import {
  getForgotPasswordUnavailableUiCopy,
  getLoginUiCopy,
} from './ui'

describe('getLoginUiCopy', () => {
  it('uses email-only wording for the login identifier', () => {
    expect(getLoginUiCopy().identifierPlaceholder).toBe('Email đăng nhập')
  })
})

describe('getForgotPasswordUnavailableUiCopy', () => {
  it('explains that forgot-password is support-only for now', () => {
    expect(
      getForgotPasswordUnavailableUiCopy('https://support.example.com'),
    ).toEqual({
      body: '',
      supportHref: 'https://support.example.com',
      supportText: 'Liên hệ hỗ trợ',
      title: 'Khôi phục mật khẩu',
    })
  })
})
