import { apiBaseUrl } from '#/lib/config/env'

export function resolveAssetUrl(url: string) {
  const normalized = url.trim()

  if (!normalized) {
    return ''
  }

  if (normalized.startsWith('http://') || normalized.startsWith('https://')) {
    return normalized
  }

  if (normalized.startsWith('/')) {
    return `${apiBaseUrl}${normalized}`
  }

  return `${apiBaseUrl}/${normalized.replace(/^\/+/, '')}`
}
