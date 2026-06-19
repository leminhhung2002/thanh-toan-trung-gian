import { ApiClientError } from './client'

const apiErrorCopy: Record<string, string> = {
  admin_balance_input_required:
    'Cần nhập ít nhất một số dư để cập nhật.',
  asset_not_found: 'Không tìm thấy tài sản.',
  bank_account_capacity_exhausted:
    'Hiện tại chưa có tài khoản ngân hàng phù hợp cho số tiền này.',
  bank_account_daily_limit_below_committed_usage:
    'Không thể giảm hạn mức ngày xuống thấp hơn phần đã duyệt hoặc đang được giữ chỗ.',
  bank_account_identity_conflict:
    'Mã ngân hàng và số tài khoản này đã tồn tại.',
  bank_account_invalid_input:
    'Thông tin tài khoản ngân hàng không được để trống.',
  bank_account_invalid_priority: 'Độ ưu tiên phải là số nguyên dương.',
  bank_account_in_use:
    'Không thể xoá tài khoản ngân hàng đang còn được sử dụng.',
  bank_account_not_found: 'Không tìm thấy tài khoản ngân hàng.',
  bank_account_priority_conflict:
    'Độ ưu tiên của tài khoản ngân hàng phải là duy nhất.',
  current_password_invalid: 'Mật khẩu hiện tại không đúng.',
  deposit_reservation_active_exists:
    'Bạn đang có một giữ chỗ nạp VND còn hiệu lực. Vui lòng hoàn tất hoặc huỷ giữ chỗ hiện tại.',
  deposit_reservation_expired: 'Giữ chỗ nạp tiền đã hết hạn.',
  deposit_reservation_invalid_state:
    'Giữ chỗ nạp tiền hiện không còn ở trạng thái có thể xử lý.',
  deposit_reservation_not_found: 'Không tìm thấy giữ chỗ nạp tiền.',
  deposit_reservation_pending_review_exists:
    'Bạn đang có một yêu cầu nạp VND chờ admin duyệt. Vui lòng chờ xử lý trước khi tạo yêu cầu mới.',
  deposit_reservation_pending_review_limit_reached:
    'Bạn đã có 10 yêu cầu nạp tiền đang chờ duyệt. Vui lòng chờ xử lý trước khi tạo yêu cầu mới.',
  deposit_already_reviewed: 'Yêu cầu nạp tiền này đã được xử lý trước đó.',
  deposit_cancel_invalid_state:
    'Yêu cầu nạp tiền này hiện không còn ở trạng thái có thể hủy.',
  deposit_not_found: 'Không tìm thấy yêu cầu nạp tiền.',
  deposit_vnd_requires_reservation:
    'Nạp VND qua chuyển khoản phải đi qua bước giữ chỗ trước.',
  duplicate_idempotency_key: 'Idempotency-Key này đã được sử dụng.',
  email_already_exists: 'Email này đã được sử dụng.',
  email_required: 'Email không được để trống.',
  exchange_asset_not_found: 'Không tìm thấy tài sản dùng để đổi tiền.',
  exchange_direction_not_supported:
    'Hệ thống hiện chỉ hỗ trợ đổi từ VND sang USDT.',
  exchange_quote_executed: 'Báo giá này đã được thực hiện.',
  exchange_quote_expired: 'Báo giá đổi tiền đã hết hạn.',
  exchange_quote_not_found: 'Không tìm thấy báo giá đổi tiền.',
  exchange_order_not_found: 'Không tìm thấy lệnh đổi tiền.',
  exchange_reverse_insufficient_received_balance:
    'Số dư tài sản đã nhận hiện không đủ để khôi phục lệnh đổi tiền này.',
  exchange_reverse_invalid_state:
    'Lệnh đổi tiền này hiện không còn ở trạng thái có thể khôi phục.',
  exchange_amount_below_fee:
    'Số tiền đổi phải lớn hơn phí giao dịch để nhận được tiền.',
  exchange_rate_not_configured: 'Hiện chưa có tỷ giá cho cặp tài sản này.',
  exchange_rate_unavailable:
    'Không thể lấy tỷ giá realtime lúc này. Vui lòng thử lại sau.',
  feature_unavailable: 'Tính năng này hiện chưa khả dụng trên hệ thống mới.',
  insufficient_balance: 'Số dư khả dụng không đủ để thực hiện giao dịch.',
  invalid_credentials: 'Email hoặc mật khẩu không đúng.',
  invalid_review_status:
    'Trạng thái duyệt không hợp lệ. Vui lòng chọn lại bộ lọc phù hợp.',
  invalid_review_date:
    'Ngày lọc không hợp lệ. Vui lòng chọn theo định dạng YYYY-MM-DD.',
  invalid_role_code: 'Vai trò được chọn không hợp lệ.',
  invalid_setting: 'Thiết lập gửi lên không hợp lệ.',
  missing_idempotency_key: 'Thiếu tiêu đề Idempotency-Key.',
  current_password_required: 'Vui lòng nhập mật khẩu hiện tại.',
  refresh_token_expired: 'Phiên đăng nhập đã hết hạn.',
  refresh_token_invalid: 'Phiên đăng nhập không còn hợp lệ.',
  required_assets_missing: 'Không tìm thấy tài sản bắt buộc trong hệ thống.',
  super_admin_required:
    'Chỉ super admin mới được phép thay đổi phân quyền.',
  telegram_runtime_config_invalid:
    'Token Telegram hoặc chat ID không hợp lệ.',
  telegram_runtime_token_required:
    'Bạn cần nhập token Telegram cho lần cấu hình đầu tiên.',
  user_not_found: 'Không tìm thấy người dùng.',
  wallet_not_found: 'Không tìm thấy ví của người dùng.',
  withdrawal_already_reviewed:
    'Yêu cầu rút tiền này đã được xử lý trước đó.',
  withdrawal_cancel_invalid_state:
    'Yêu cầu rút tiền này hiện không còn ở trạng thái có thể hủy.',
  withdrawal_cancel_rollback_mismatch:
    'Số dư chờ xử lý hiện không còn khớp để hoàn tác yêu cầu rút tiền này.',
  withdrawal_not_found: 'Không tìm thấy yêu cầu rút tiền.',
}

export function translateApiError(error: unknown, fallback = 'Đã xảy ra lỗi.') {
  if (error instanceof ApiClientError) {
    if (error.code && apiErrorCopy[error.code]) {
      return apiErrorCopy[error.code]
    }

    return error.message || fallback
  }

  if (error instanceof Error) {
    return error.message || fallback
  }

  return fallback
}
