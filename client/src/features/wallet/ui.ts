export function getFreshDepositUiCopy() {
  return {
    helperText:
      'Hệ thống sẽ tự chọn tài khoản ngân hàng fallback theo priority và hạn mức còn lại, sau đó giữ chỗ trong một khoảng thời gian nhất định để tránh vượt hạn mức khi nhiều người cùng nạp.',
    noteText:
      'Bước 1: lấy thông tin nạp. Bước 2: chuyển khoản đúng nội dung. Bước 3: quay lại bấm Đã nạp tiền để gửi yêu cầu sang admin.',
    title: 'Lấy thông tin nạp trước khi chuyển khoản',
  }
}

type ShouldBlockDashboardOnLoadInput = {
  currentReservationPending: boolean
  profilePending: boolean
  showDepositModal: boolean
  walletsPending: boolean
}

type ActiveReservationUiCopyInput = {
  reservationExpired: boolean
  reservationId?: string | null
  supportLink: string
}

type PendingReviewUiCopyInput = {
  depositRequestId?: string | null
  supportLink: string
}

export function getActiveReservationUiCopy({
  reservationExpired,
  reservationId,
  supportLink,
}: ActiveReservationUiCopyInput) {
  return {
    helperText: reservationExpired
      ? 'Giữ chỗ đã hết hạn. Nếu bạn đã lỡ chuyển tiền, vui lòng liên hệ hỗ trợ để đối soát thủ công trước khi tạo lượt nạp mới.'
      : 'Bạn đang ở bước chuyển khoản. Hãy dùng đúng số tiền, đúng tài khoản và đúng nội dung bên dưới trước khi bấm Đã nạp tiền.',
    noteText:
      'Số dư VND chỉ được cộng sau khi bạn bấm Đã nạp tiền và admin xác nhận giao dịch thành công.',
    referenceValue: reservationId || 'Đang cập nhật',
    statusText:
      'Hệ thống đã giữ chỗ một tài khoản ngân hàng phù hợp theo hạn mức hôm nay. Sau khi chuyển khoản xong, bạn cần quay lại bấm Đã nạp tiền để gửi yêu cầu sang admin.',
    supportHref: supportLink,
    supportText: 'Liên hệ hỗ trợ đối soát',
    timingTextPrefix: reservationExpired ? 'Giữ chỗ đã hết hạn' : 'Giữ chỗ còn hiệu lực trong',
    title: 'Giữ chỗ nạp tiền thành công',
  }
}

export function getPendingReviewUiCopy({
  depositRequestId,
  supportLink,
}: PendingReviewUiCopyInput) {
  return {
    helperText:
      'Bạn chưa thể tạo lượt nạp VND mới hoặc huỷ giữ chỗ cho tới khi admin duyệt hoặc từ chối yêu cầu này.',
    noteText:
      'Nếu cần đối soát, hãy giữ lại nội dung chuyển khoản và mã tham chiếu bên dưới khi liên hệ hỗ trợ.',
    referenceValue: depositRequestId || 'Đang cập nhật',
    statusText:
      'Bạn đã bấm Đã nạp tiền. Yêu cầu hiện đã nằm trong hàng chờ để admin kiểm tra và xác nhận giao dịch.',
    supportHref: supportLink,
    supportText: 'Liên hệ hỗ trợ đối soát',
    title: 'Yêu cầu nạp tiền đã gửi tới admin',
  }
}

export function shouldBlockDashboardOnLoad({
  currentReservationPending: _currentReservationPending,
  profilePending,
  showDepositModal: _showDepositModal,
  walletsPending,
}: ShouldBlockDashboardOnLoadInput) {
  if (walletsPending || profilePending) {
    return true
  }

  return false
}
