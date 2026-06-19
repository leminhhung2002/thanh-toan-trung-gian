import { describe, expect, it } from 'vitest'
import {
  getHistoryPollingOptions,
  HISTORY_POLL_INTERVAL_MS,
} from './polling'

describe('getHistoryPollingOptions', () => {
  it('enables 5-second polling for the history page by default', () => {
    expect(getHistoryPollingOptions()).toEqual({
      refetchInterval: HISTORY_POLL_INTERVAL_MS,
      refetchIntervalInBackground: false,
    })
  })

  it('disables polling when the caller marks the query as inactive', () => {
    expect(getHistoryPollingOptions({ enabled: false })).toEqual({
      refetchInterval: false,
      refetchIntervalInBackground: false,
    })
  })
})
