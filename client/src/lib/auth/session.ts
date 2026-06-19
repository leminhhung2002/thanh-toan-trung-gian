import type { AuthSession } from '../types'

export const AUTH_SESSION_STORAGE_KEY = 'nganluong.auth-session'

type SessionListener = () => void

export type BrowserSessionStore = {
  clear: () => void
  get: () => AuthSession | null
  set: (session: AuthSession) => void
  subscribe: (listener: SessionListener) => () => void
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as Partial<AuthSession>

  return Boolean(
    typeof candidate.accessToken === 'string' &&
      typeof candidate.refreshToken === 'string' &&
      candidate.user &&
      typeof candidate.user.email === 'string' &&
      typeof candidate.user.id === 'string' &&
      Array.isArray(candidate.user.roles),
  )
}

export function getStoredSession() {
  if (!canUseLocalStorage()) {
    return null
  }

  const rawValue = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)

  if (!rawValue) {
    return null
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown
    return isAuthSession(parsedValue) ? parsedValue : null
  } catch {
    return null
  }
}

export function setStoredSession(session: AuthSession) {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  if (!canUseLocalStorage()) {
    return
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY)
}

export function createBrowserSessionStore(): BrowserSessionStore {
  let currentSession = getStoredSession()
  const listeners = new Set<SessionListener>()

  const notifyListeners = () => {
    listeners.forEach((listener) => {
      listener()
    })
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== AUTH_SESSION_STORAGE_KEY) {
      return
    }

    currentSession = getStoredSession()
    notifyListeners()
  }

  return {
    get: () => currentSession,
    set: (session) => {
      currentSession = session
      setStoredSession(session)
      notifyListeners()
    },
    clear: () => {
      currentSession = null
      clearStoredSession()
      notifyListeners()
    },
    subscribe: (listener) => {
      listeners.add(listener)

      if (listeners.size === 1 && typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorage)
      }

      return () => {
        listeners.delete(listener)

        if (listeners.size === 0 && typeof window !== 'undefined') {
          window.removeEventListener('storage', handleStorage)
        }
      }
    },
  }
}
