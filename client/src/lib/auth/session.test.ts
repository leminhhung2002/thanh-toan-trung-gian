// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '../types'
import {
  AUTH_SESSION_STORAGE_KEY,
  clearStoredSession,
  createBrowserSessionStore,
  getStoredSession,
  setStoredSession,
} from './session'

const baseSession: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    email: 'user@example.com',
    id: 'user-id',
    roles: ['user'],
  },
}

describe('session storage helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stores and reads the auth session from localStorage', () => {
    setStoredSession(baseSession)

    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeTruthy()
    expect(getStoredSession()).toEqual(baseSession)
  })

  it('returns null for invalid stored JSON', () => {
    window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, '{bad json')

    expect(getStoredSession()).toBeNull()
  })

  it('clears the stored auth session', () => {
    setStoredSession(baseSession)

    clearStoredSession()

    expect(getStoredSession()).toBeNull()
    expect(window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull()
  })
})

describe('browser session store', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('notifies subscribers when the session changes', () => {
    const store = createBrowserSessionStore()
    const listener = vi.fn()

    const unsubscribe = store.subscribe(listener)

    store.set(baseSession)
    store.clear()
    unsubscribe()
    store.set(baseSession)

    expect(listener).toHaveBeenCalledTimes(2)
  })
})
