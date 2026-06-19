import { describe, expect, it } from 'vitest'

import type { AuthSession } from '../types'
import { requireAdminRole, requireUserSession } from './guards'

const userSession: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  user: {
    email: 'user@example.com',
    id: 'user-id',
    roles: ['user'],
  },
}

describe('auth guard helpers', () => {
  it('returns false when the user session is missing', () => {
    expect(requireUserSession(null)).toBe(false)
  })

  it('returns true when an authenticated session exists', () => {
    expect(requireUserSession(userSession)).toBe(true)
  })

  it('returns false for a normal user on admin routes', () => {
    expect(requireAdminRole(userSession)).toBe(false)
  })

  it('returns true for admin and super_admin roles', () => {
    expect(
      requireAdminRole({
        ...userSession,
        user: {
          ...userSession.user,
          roles: ['admin'],
        },
      }),
    ).toBe(true)

    expect(
      requireAdminRole({
        ...userSession,
        user: {
          ...userSession.user,
          roles: ['super_admin'],
        },
      }),
    ).toBe(true)
  })
})
