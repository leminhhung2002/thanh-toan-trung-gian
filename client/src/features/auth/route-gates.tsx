import { Navigate } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { ScreenLoader } from '#/components/screen-loader'
import { useAuthSession } from '#/lib/auth/auth-context'
import { requireAdminRole, requireUserSession } from '#/lib/auth/guards'

export function GuestOnly({ children }: { children: ReactNode }) {
  const { hydrated, session } = useAuthSession()

  if (!hydrated) {
    return <ScreenLoader />
  }

  if (requireUserSession(session)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export function RequireUser({ children }: { children: ReactNode }) {
  const { hydrated, session } = useAuthSession()

  if (!hydrated) {
    return <ScreenLoader />
  }

  if (!requireUserSession(session)) {
    return <Navigate to="/" replace />
  }

  return children
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { hydrated, session } = useAuthSession()

  if (!hydrated) {
    return <ScreenLoader />
  }

  if (!requireUserSession(session)) {
    return <Navigate to="/" replace />
  }

  if (!requireAdminRole(session)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
