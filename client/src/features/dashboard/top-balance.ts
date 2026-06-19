import { formatVnd } from '#/lib/utils/format'

export function getDashboardVndBalanceLabel(availableBalance = '0') {
  return formatVnd(availableBalance)
}
