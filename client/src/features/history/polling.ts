export const HISTORY_POLL_INTERVAL_MS = 5_000

export function getHistoryPollingOptions(input?: { enabled?: boolean }) {
  const shouldPoll = input?.enabled ?? true

  return {
    refetchInterval: shouldPoll ? HISTORY_POLL_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
  } as const
}
