import { describe, expect, it } from 'vitest'

import {
  buildReviewInvalidationKeys,
  getNextBankPriority,
  normalizeReviewNote,
} from './shell-state'

describe('admin shell state helpers', () => {
  it('normalizes blank review notes to undefined for approve/reject calls', () => {
    expect(normalizeReviewNote('   ')).toBeUndefined()
    expect(normalizeReviewNote(' checked ')).toEqual({ note: 'checked' })
  })

  it('computes the next bank priority from the current bank list', () => {
    expect(getNextBankPriority([])).toBe('1')
    expect(getNextBankPriority([{ priority: 4 }, { priority: 2 }])).toBe('5')
  })

  it('returns the query keys that need refresh after a financial review action', () => {
    expect(buildReviewInvalidationKeys()).toEqual([
      ['admin', 'deposits'],
      ['admin', 'withdrawals'],
      ['deposits'],
      ['withdrawals'],
      ['history'],
      ['wallets'],
    ])
  })
})
