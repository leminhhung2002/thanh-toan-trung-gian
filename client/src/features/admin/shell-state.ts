import type { AdminReviewInput } from '#/lib/types'

export function normalizeReviewNote(note?: string): AdminReviewInput | undefined {
  const normalized = note?.trim()
  return normalized ? { note: normalized } : undefined
}

export function getNextBankPriority(
  bankAccounts: Array<{
    priority: number
  }>,
) {
  if (bankAccounts.length === 0) {
    return '1'
  }

  return String(Math.max(...bankAccounts.map((item) => item.priority), 0) + 1)
}

export function buildReviewInvalidationKeys() {
  return [
    ['admin', 'deposits'],
    ['admin', 'withdrawals'],
    ['deposits'],
    ['withdrawals'],
    ['history'],
    ['wallets'],
  ] as const
}
