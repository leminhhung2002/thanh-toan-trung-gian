import type { AuthSession, AuthUser, Profile, WalletSummary } from '#/lib/types'
import { apiClient } from '#/lib/api/app-client'

type AuthResult = {
  accessToken: string
  refreshToken: string
  user: AuthUser
  wallets: WalletSummary[]
}

type LoginInput = {
  email: string
  password: string
}

type RegisterInput = {
  email: string
  password: string
  phone?: string
  telegram?: string
}

export const authApi = {
  login: (input: LoginInput) =>
    apiClient.post<AuthResult, LoginInput>('/auth/login', input),
  logout: (refreshToken: string) =>
    apiClient.post<{ success: boolean }, { refreshToken: string }>(
      '/auth/logout',
      { refreshToken },
    ),
  me: () => apiClient.get<Profile>('/auth/me', { auth: true }),
  register: (input: RegisterInput) =>
    apiClient.post<AuthResult, RegisterInput>('/auth/register', input),
}

export function toSession(result: AuthResult): AuthSession {
  return {
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    user: result.user,
  }
}
