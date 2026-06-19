function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

export const apiBaseUrl = trimTrailingSlashes(
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000',
)

export const apiV1BaseUrl = `${apiBaseUrl}/api/v1`
