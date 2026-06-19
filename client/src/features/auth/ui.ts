export function getLoginUiCopy() {
  return {
    identifierPlaceholder: 'Email đăng nhập',
  }
}

export function getForgotPasswordUnavailableUiCopy(supportLink: string) {
  return {
    body: '',
    supportHref: supportLink,
    supportText: 'Liên hệ hỗ trợ',
    title: 'Khôi phục mật khẩu',
  }
}
