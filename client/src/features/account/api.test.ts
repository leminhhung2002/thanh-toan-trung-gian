import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}))

vi.mock('#/lib/api/app-client', () => ({
  apiClient: {
    get: mocks.get,
    patch: mocks.patch,
    post: mocks.post,
  },
}))

const { accountApi } = await import('./api')

describe('account api helpers', () => {
  beforeEach(() => {
    mocks.get.mockReset()
    mocks.patch.mockReset()
    mocks.post.mockReset()
  })

  it('loads the profile endpoint with auth', async () => {
    mocks.get.mockResolvedValueOnce({
      email: 'user@example.com',
      id: 'user-1',
      phone: null,
      roles: ['user'],
      telegram: null,
      twoFactorEnabled: false,
    })

    await accountApi.getProfile()

    expect(mocks.get).toHaveBeenCalledWith('/profile', { auth: true })
  })

  it('submits change-password with password-only confirmation', async () => {
    mocks.post.mockResolvedValue({ success: true })

    await accountApi.changePassword({
      currentPassword: 'Secret123!',
      newPassword: 'Changed123!',
    })

    expect(mocks.post).toHaveBeenCalledWith(
      '/profile/change-password',
      {
        currentPassword: 'Secret123!',
        newPassword: 'Changed123!',
      },
      { auth: true },
    )
  })

  it('updates the profile with auth-enabled patch requests', async () => {
    mocks.patch.mockResolvedValue({
      phone: '0901234567',
      telegram: '@wallet',
    })

    await accountApi.updateProfile({
      currentPassword: 'Secret123!',
      phone: '0901234567',
      telegram: '@wallet',
    })

    expect(mocks.patch).toHaveBeenCalledWith(
      '/profile',
      {
        currentPassword: 'Secret123!',
        phone: '0901234567',
        telegram: '@wallet',
      },
      { auth: true },
    )
  })
})
