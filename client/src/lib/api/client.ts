import type { ApiEnvelope, ApiErrorEnvelope, AuthSession } from '../types'

export class ApiClientError extends Error {
  code?: string
  details?: unknown
  requestId?: string
  status: number

  constructor(options: {
    code?: string
    details?: unknown
    message: string
    requestId?: string
    status: number
  }) {
    super(options.message)
    this.name = 'ApiClientError'
    this.code = options.code
    this.details = options.details
    this.requestId = options.requestId
    this.status = options.status
  }
}

export type SessionStore = {
  clear: () => void
  get: () => AuthSession | null
  set: (session: AuthSession) => void
}

type RequestOptions = {
  auth?: boolean
  headers?: HeadersInit
}

type ApiClientOptions = {
  baseUrl: string
  fetchImpl?: typeof fetch
  onUnauthorized?: () => void
  sessionStore: SessionStore
}

function joinUrl(baseUrl: string, path: string) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  const trimmedBase = baseUrl.replace(/\/+$/, '')
  const trimmedPath = path.startsWith('/') ? path : `/${path}`

  return `${trimmedBase}${trimmedPath}`
}

function toApiError(status: number, payload: unknown, fallbackMessage: string) {
  const errorPayload = payload as ApiErrorEnvelope | undefined
  const normalizedError = errorPayload?.error

  return new ApiClientError({
    code: normalizedError?.code,
    details: normalizedError?.details,
    message: normalizedError?.message ?? fallbackMessage,
    requestId: normalizedError?.requestId,
    status,
  })
}

async function readResponsePayload(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

function withHeaders(baseHeaders?: HeadersInit, extraHeaders?: HeadersInit) {
  const headers = new Headers(baseHeaders)
  const additions = new Headers(extraHeaders)

  additions.forEach((value, key) => {
    headers.set(key, value)
  })

  return Object.fromEntries(headers.entries())
}

export function createMemorySessionStore(initialSession: AuthSession | null): SessionStore {
  let currentSession = initialSession

  return {
    get: () => currentSession,
    set: (session) => {
      currentSession = session
    },
    clear: () => {
      currentSession = null
    },
  }
}

export function createApiClient({
  baseUrl,
  fetchImpl = fetch,
  onUnauthorized,
  sessionStore,
}: ApiClientOptions) {
  async function refreshSession() {
    const currentSession = sessionStore.get()

    if (!currentSession?.refreshToken) {
      sessionStore.clear()
      onUnauthorized?.()
      throw new ApiClientError({
        message: 'Missing refresh token',
        status: 401,
      })
    }

    const response = await fetchImpl(joinUrl(baseUrl, '/auth/refresh'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken: currentSession.refreshToken,
      }),
    })

    const payload = await readResponsePayload(response)

    if (!response.ok) {
      sessionStore.clear()
      onUnauthorized?.()
      throw toApiError(response.status, payload, 'Failed to refresh session')
    }

    const data = (payload as ApiEnvelope<Pick<AuthSession, 'accessToken' | 'refreshToken'>>)
      .data

    const updatedSession: AuthSession = {
      ...currentSession,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    }

    sessionStore.set(updatedSession)

    return updatedSession
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
    options: RequestOptions = {},
    hasRetried = false,
  ): Promise<T> {
    const session = sessionStore.get()
    const headers = withHeaders(init.headers, options.headers)

    if (options.auth && session?.accessToken) {
      headers.Authorization = `Bearer ${session.accessToken}`
    }

    const response = await fetchImpl(joinUrl(baseUrl, path), {
      ...init,
      headers,
    })
    const payload = await readResponsePayload(response)

    if (
      response.status === 401 &&
      options.auth &&
      !hasRetried &&
      session?.refreshToken
    ) {
      const refreshedSession = await refreshSession()

      return request<T>(
        path,
        {
          ...init,
          headers: withHeaders(init.headers, {
            Authorization: `Bearer ${refreshedSession.accessToken}`,
          }),
        },
        options,
        true,
      )
    }

    if (!response.ok) {
      throw toApiError(response.status, payload, 'API request failed')
    }

    return (payload as ApiEnvelope<T>).data
  }

  return {
    get: <T>(path: string, options?: RequestOptions) =>
      request<T>(path, { method: 'GET' }, options),
    patch: <TResponse, TBody>(
      path: string,
      body: TBody,
      options?: RequestOptions,
    ) =>
      request<TResponse>(
        path,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        options,
      ),
    put: <TResponse, TBody>(path: string, body: TBody, options?: RequestOptions) =>
      request<TResponse>(
        path,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        options,
      ),
    post: <TResponse, TBody>(
      path: string,
      body: TBody,
      options?: RequestOptions,
    ) =>
      request<TResponse>(
        path,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        },
        options,
      ),
    postFormData: <TResponse>(
      path: string,
      body: FormData,
      options?: RequestOptions,
    ) =>
      request<TResponse>(
        path,
        {
          method: 'POST',
          body,
        },
        options,
      ),
    delete: <TResponse>(path: string, options?: RequestOptions) =>
      request<TResponse>(
        path,
        {
          method: 'DELETE',
        },
        options,
      ),
    request,
  }
}
