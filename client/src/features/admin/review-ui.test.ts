import { describe, expect, it } from 'vitest'

import { getDepositReviewUiCopy, getWithdrawalReviewUiCopy } from './review-ui'

describe('getDepositReviewUiCopy', () => {
  it('explains the admin review semantics for deposit requests', () => {
    expect(getDepositReviewUiCopy()).toEqual({
      emptyMessage: 'Chưa có yêu cầu nạp tiền nào ở bộ lọc này.',
      loadingMessage: 'Đang tải danh sách nạp tiền...',
      pendingLabel: 'Duyệt yêu cầu nạp tiền',
    })
  })
})

describe('getWithdrawalReviewUiCopy', () => {
  it('explains the admin review semantics for withdrawal requests', () => {
    expect(getWithdrawalReviewUiCopy()).toEqual({
      emptyMessage: 'Chưa có yêu cầu rút tiền nào ở bộ lọc này.',
      loadingMessage: 'Đang tải danh sách rút tiền...',
      pendingLabel: 'Duyệt yêu cầu rút tiền',
    })
  })
})
