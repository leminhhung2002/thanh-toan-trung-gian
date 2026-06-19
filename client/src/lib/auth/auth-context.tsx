import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react'

import type { ReactNode } from 'react'
import type { AuthSession } from '../types'
import { createBrowserSessionStore } from './session'

const browserSessionStore = createBrowserSessionStore()

type AuthContextValue = {
  clearSession: () => void
  hydrated: boolean
  session: AuthSession | null
  setSession: (session: AuthSession) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    browserSessionStore.subscribe,
    browserSessionStore.get,
    () => null,
  )
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setHydrated(true)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        hydrated,
        setSession: browserSessionStore.set,
        clearSession: browserSessionStore.clear,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuthSession() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider')
  }

  return context
}

export { browserSessionStore }
