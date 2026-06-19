import { browserSessionStore } from '../auth/auth-context'
import { apiV1BaseUrl } from '../config/env'
import { createApiClient } from './client'

export const apiClient = createApiClient({
  baseUrl: apiV1BaseUrl,
  sessionStore: browserSessionStore,
  onUnauthorized: () => {
    if (typeof window === 'undefined') {
      return
    }

    if (window.location.pathname !== '/') {
      window.location.assign('/')
    }
  },
})
