import type { AdminStatusFilter } from './api'

export function shouldShowRestorePendingAction(input: {
  itemStatus: string
  statusFilter: AdminStatusFilter
}) {
  if (input.itemStatus !== 'approved' && input.itemStatus !== 'rejected') {
    return false
  }

  if (input.statusFilter === 'pending') {
    return false
  }

  if (input.statusFilter === 'all') {
    return true
  }

  return input.itemStatus === input.statusFilter
}
