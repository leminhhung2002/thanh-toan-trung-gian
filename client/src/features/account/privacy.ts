const EMPTY_PLACEHOLDER = 'Chưa cập nhật'

export function maskSensitiveValue(value: string | null | undefined) {
  const normalized = value?.trim() ?? ''

  if (!normalized) {
    return EMPTY_PLACEHOLDER
  }

  if (normalized.length <= 4) {
    return normalized
  }

  return `${normalized.slice(0, 2)}${'*'.repeat(normalized.length - 4)}${normalized.slice(-2)}`
}

export function getSensitiveFieldDisplayValue(input: {
  kind: 'email' | 'phone' | 'telegram'
  value: string | null | undefined
}) {
  return maskSensitiveValue(input.value)
}
