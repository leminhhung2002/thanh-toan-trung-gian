import type { LegacyAdminTabId } from './ui'

export function getAdminPollingOptions(input: {
  activeTab: LegacyAdminTabId
  targetTab: 'banks' | 'exchange' | 'transactions' | 'withdrawals'
}) {
  const shouldPoll = input.activeTab === input.targetTab

  return {
    refetchInterval: shouldPoll ? 5000 : false,
    refetchIntervalInBackground: false,
  } as const
}
