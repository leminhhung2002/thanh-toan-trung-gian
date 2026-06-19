import { createFileRoute } from '@tanstack/react-router'
import { RequireUser } from '#/features/auth/route-gates'
import { DashboardScreen } from '#/features/dashboard/dashboard-screen'

export const Route = createFileRoute('/dashboard')({
  component: DashboardRoute,
})

function DashboardRoute() {
  return (
    <RequireUser>
      <DashboardScreen />
    </RequireUser>
  )
}
