import type { AuthSession } from '../types'

export function requireUserSession(session: AuthSession | null) {
  return Boolean(session?.accessToken && session.refreshToken && session.user)
}

export function requireAdminRole(session: AuthSession | null) {
  if (!requireUserSession(session)) {
    return false
  }

  const user = session?.user

  if (!user) {
    return false
  }

  return user.roles.some((role) => role === 'admin' || role === 'super_admin')
}
