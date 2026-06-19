import { describe, expect, it } from 'vitest'

import {
  formatReservationCountdown,
  getReservationSecondsLeft,
  isReservationExpired,
} from './reservation'

describe('deposit reservation helpers', () => {
  it('counts down remaining seconds and never returns negative values', () => {
    expect(
      getReservationSecondsLeft('2026-04-03T03:16:00.000Z', Date.parse('2026-04-03T03:15:15.000Z')),
    ).toBe(45)
    expect(
      getReservationSecondsLeft('2026-04-03T03:15:00.000Z', Date.parse('2026-04-03T03:15:15.000Z')),
    ).toBe(0)
  })

  it('formats the reservation countdown the way the deposit modal needs it', () => {
    expect(formatReservationCountdown(605)).toBe('10:05')
    expect(formatReservationCountdown(9)).toBe('00:09')
  })

  it('marks the reservation as expired once the deadline is reached', () => {
    expect(
      isReservationExpired('2026-04-03T03:15:00.000Z', Date.parse('2026-04-03T03:15:00.000Z')),
    ).toBe(true)
    expect(
      isReservationExpired('2026-04-03T03:15:30.000Z', Date.parse('2026-04-03T03:15:00.000Z')),
    ).toBe(false)
  })
})
