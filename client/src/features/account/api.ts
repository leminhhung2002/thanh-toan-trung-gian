import type { Profile } from '#/lib/types'
import { apiClient } from '#/lib/api/app-client'

type ChangePasswordInput = {
  currentPassword: string
  newPassword: string
}

type UpdateProfileInput = {
  currentPassword?: string
  phone?: string | null
  telegram?: string | null
}

export const accountApi = {
  changePassword: (input: ChangePasswordInput) =>
    apiClient.post<{ success: boolean }, ChangePasswordInput>(
      '/profile/change-password',
      input,
      { auth: true },
    ),
  getProfile: () => apiClient.get<Profile>('/profile', { auth: true }),
  updateProfile: (input: UpdateProfileInput) =>
    apiClient.patch<Profile, UpdateProfileInput>('/profile', input, {
      auth: true,
    }),
}
