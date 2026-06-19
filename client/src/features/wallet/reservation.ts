export function getReservationSecondsLeft(expiresAt: string, now = Date.now()) {
  const expiresAtMs = Date.parse(expiresAt)

  if (Number.isNaN(expiresAtMs)) {
    return 0
  }

  return Math.max(0, Math.floor((expiresAtMs - now) / 1000))
}

export function formatReservationCountdown(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60

  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
}

export function isReservationExpired(expiresAt: string, now = Date.now()) {
  return getReservationSecondsLeft(expiresAt, now) <= 0
}
