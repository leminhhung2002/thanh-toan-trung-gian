import type { AdminBankAccount } from '#/lib/types'

function toNumber(value: string) {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export function getConsumedCapacity(bank: Pick<
  AdminBankAccount,
  'reservedPendingReview' | 'reservedUnconfirmed' | 'usedToday'
>) {
  return (
    toNumber(bank.usedToday) +
    toNumber(bank.reservedPendingReview) +
    toNumber(bank.reservedUnconfirmed)
  )
}

export function getCapacityPercent(bank: Pick<
  AdminBankAccount,
  'dailyLimit' | 'reservedPendingReview' | 'reservedUnconfirmed' | 'usedToday'
>) {
  const dailyLimit = toNumber(bank.dailyLimit)
  if (dailyLimit <= 0) {
    return 0
  }

  return Math.min(100, (getConsumedCapacity(bank) / dailyLimit) * 100)
}
