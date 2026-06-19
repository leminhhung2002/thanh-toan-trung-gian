import { describe, expect, it } from 'vitest'

import { ApiClientError } from './client'
import { translateApiError } from './error-copy'

describe('translateApiError', () => {
  it('maps money-flow error codes into stable Vietnamese UI copy', () => {
    expect(
      translateApiError(
        new ApiClientError({
          code: 'deposit_reservation_active_exists',
          message: 'server message',
          status: 409,
        }),
      ),
    ).toBe(
      'Bạn đang có một giữ chỗ nạp VND còn hiệu lực. Vui lòng hoàn tất hoặc huỷ giữ chỗ hiện tại.',
    )

    expect(
      translateApiError(
        new ApiClientError({
          code: 'deposit_reservation_pending_review_limit_reached',
          message: 'server message',
          status: 409,
        }),
      ),
    ).toBe(
      'Bạn đã có 10 yêu cầu nạp tiền đang chờ duyệt. Vui lòng chờ xử lý trước khi tạo yêu cầu mới.',
    )

    expect(
      translateApiError(
        new ApiClientError({
          code: 'bank_account_in_use',
          message: 'server message',
          status: 409,
        }),
      ),
    ).toBe('Không thể xoá tài khoản ngân hàng đang còn được sử dụng.')

    expect(
      translateApiError(
        new ApiClientError({
          code: 'bank_account_daily_limit_below_committed_usage',
          message: 'server message',
          status: 409,
        }),
      ),
    ).toBe(
      'Không thể giảm hạn mức ngày xuống thấp hơn phần đã duyệt hoặc đang được giữ chỗ.',
    )
  })

  it('falls back to the backend message when no specialized copy exists', () => {
    expect(
      translateApiError(
        new ApiClientError({
          code: 'unknown_code',
          message: 'Some backend message',
          status: 400,
        }),
      ),
    ).toBe('Some backend message')
  })
})
