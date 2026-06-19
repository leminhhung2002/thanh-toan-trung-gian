import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthSession } from '#/lib/auth/auth-context'
import { queryKeys } from '#/lib/query-keys'
import { authApi } from './api'

export function AuthBootstrap() {
  const { hydrated, session, setSession } = useAuthSession()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: queryKeys.authMe,
    queryFn: authApi.me,
    enabled: hydrated && Boolean(session?.accessToken),
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (!data || !session) {
      return
    }

    queryClient.setQueryData(queryKeys.profile, data)

    const nextUser = {
      email: data.email,
      id: data.id,
      roles: data.roles,
    }

    const currentUser = session.user
    const didChange =
      currentUser.email !== nextUser.email ||
      currentUser.id !== nextUser.id ||
      currentUser.roles.join('|') !== nextUser.roles.join('|')

    if (didChange) {
      setSession({
        ...session,
        user: nextUser,
      })
    }
  }, [data, queryClient, session, setSession])

  return null
}
