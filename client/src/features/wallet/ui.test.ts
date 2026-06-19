import { describe, expect, it } from 'vitest'

import {
  getActiveReservationUiCopy,
  getFreshDepositUiCopy,
  getPendingReviewUiCopy,
  shouldBlockDashboardOnLoad,
} from './ui'

describe('getFreshDepositUiCopy', () => {
  it('builds onboarding copy for the initial VND deposit state', () => {
    expect(getFreshDepositUiCopy()).toEqual({
      helperText:
        'Hệ thống sẽ tự chọn tài khoản ngân hàng fallback theo priority và hạn mức còn lại, sau đó giữ chỗ trong một khoảng thời gian nhất định để tránh vượt hạn mức khi nhiều người cùng nạp.',
      noteText:
        'Bước 1: lấy thông tin nạp. Bước 2: chuyển khoản đúng nội dung. Bước 3: quay lại bấm Đã nạp tiền để gửi yêu cầu sang admin.',
      title: 'Lấy thông tin nạp trước khi chuyển khoản',
    })
  })
})

describe('getActiveReservationUiCopy', () => {
  it('builds clear copy for an active reservation that is still valid', () => {
    expect(
      getActiveReservationUiCopy({
        reservationExpired: false,
        reservationId: 'res_123456789',
        supportLink: 'https://support.example.com',
      }),
    ).toEqual({
      helperText:
        'Bạn đang ở bước chuyển khoản. Hãy dùng đúng số tiền, đúng tài khoản và đúng nội dung bên dưới trước khi bấm Đã nạp tiền.',
      noteText:
        'Số dư VND chỉ được cộng sau khi bạn bấm Đã nạp tiền và admin xác nhận giao dịch thành công.',
      referenceValue: 'res_123456789',
      statusText:
        'Hệ thống đã giữ chỗ một tài khoản ngân hàng phù hợp theo hạn mức hôm nay. Sau khi chuyển khoản xong, bạn cần quay lại bấm Đã nạp tiền để gửi yêu cầu sang admin.',
      supportHref: 'https://support.example.com',
      supportText: 'Liên hệ hỗ trợ đối soát',
      timingTextPrefix: 'Giữ chỗ còn hiệu lực trong',
      title: 'Giữ chỗ nạp tiền thành công',
    })
  })

  it('switches the timing copy when the reservation has expired', () => {
    expect(
      getActiveReservationUiCopy({
        reservationExpired: true,
        reservationId: null,
        supportLink: '#',
      }),
    ).toMatchObject({
      helperText:
        'Giữ chỗ đã hết hạn. Nếu bạn đã lỡ chuyển tiền, vui lòng liên hệ hỗ trợ để đối soát thủ công trước khi tạo lượt nạp mới.',
      referenceValue: 'Đang cập nhật',
      timingTextPrefix: 'Giữ chỗ đã hết hạn',
    })
  })
})

describe('getPendingReviewUiCopy', () => {
  it('builds clear waiting-state copy with a request reference', () => {
    expect(
      getPendingReviewUiCopy({
        depositRequestId: 'dep_123456789',
        supportLink: 'https://support.example.com',
      }),
    ).toEqual({
      helperText:
        'Bạn chưa thể tạo lượt nạp VND mới hoặc huỷ giữ chỗ cho tới khi admin duyệt hoặc từ chối yêu cầu này.',
      noteText:
        'Nếu cần đối soát, hãy giữ lại nội dung chuyển khoản và mã tham chiếu bên dưới khi liên hệ hỗ trợ.',
      referenceValue: 'dep_123456789',
      statusText:
        'Bạn đã bấm Đã nạp tiền. Yêu cầu hiện đã nằm trong hàng chờ để admin kiểm tra và xác nhận giao dịch.',
      supportHref: 'https://support.example.com',
      supportText: 'Liên hệ hỗ trợ đối soát',
      title: 'Yêu cầu nạp tiền đã gửi tới admin',
    })
  })

  it('falls back gracefully when the deposit request id is missing', () => {
    expect(
      getPendingReviewUiCopy({
        depositRequestId: null,
        supportLink: '#',
      }).referenceValue,
    ).toBe('Đang cập nhật')
  })
})

describe('shouldBlockDashboardOnLoad', () => {
  it('ignores the current reservation query until the deposit modal is opened', () => {
    expect(
      shouldBlockDashboardOnLoad({
        currentReservationPending: true,
        profilePending: false,
        showDepositModal: false,
        walletsPending: false,
      }),
    ).toBe(false)

    expect(
      shouldBlockDashboardOnLoad({
        currentReservationPending: true,
        profilePending: false,
        showDepositModal: true,
        walletsPending: false,
      }),
    ).toBe(false)
  })
})
