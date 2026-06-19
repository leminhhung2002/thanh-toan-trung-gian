export function formatFeePercentInputFromBps(value: number) {
  const percent = value / 100

  return Number.isInteger(percent) ? String(percent) : String(percent)
}

export function parseFeePercentInputToBps(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    return null
  }

  const bps = Math.round(parsed * 100)

  if (Math.abs(parsed * 100 - bps) > Number.EPSILON) {
    return null
  }

  return bps
}
