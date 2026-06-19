import { describe, expect, it } from 'vitest'

import { shouldShowRestorePendingAction } from './review-actions'

describe('shouldShowRestorePendingAction', () => {
  it('shows restore only for approved or rejected cards under the matching filter', () => {
    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'approved',
        statusFilter: 'approved',
      }),
    ).toBe(true)

    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'rejected',
        statusFilter: 'rejected',
      }),
    ).toBe(true)
  })

  it('shows restore in the all filter for approved or rejected cards', () => {
    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'approved',
        statusFilter: 'all',
      }),
    ).toBe(true)

    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'rejected',
        statusFilter: 'all',
      }),
    ).toBe(true)
  })

  it('hides restore under the pending filter and for pending items', () => {
    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'pending',
        statusFilter: 'pending',
      }),
    ).toBe(false)

    expect(
      shouldShowRestorePendingAction({
        itemStatus: 'rejected',
        statusFilter: 'pending',
      }),
    ).toBe(false)
  })
})
