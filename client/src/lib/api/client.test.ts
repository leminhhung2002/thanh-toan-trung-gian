import { describe, expect, it, vi } from 'vitest'

import type { AuthSession } from '../types'
import { createApiClient, createMemorySessionStore } from './client'

const session: AuthSession = {
  accessToken: 'old-access-token',
  refreshToken: 'old-refresh-token',
  user: {
    email: 'user@example.com',
    id: 'user-id',
    roles: ['user'],
  },
}

describe('api client', () => {
  it('unwraps the backend data envelope', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            email: 'user@example.com',
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetchImpl,
      sessionStore: createMemorySessionStore(session),
    })

    const data = await client.get<{ email: string }>('/profile', {
      auth: true,
    })

    expect(data).toEqual({ email: 'user@example.com' })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer old-access-token',
        }),
      }),
    )
  })

  it('refreshes once after a 401 response and retries the original request', async () => {
    const sessionStore = createMemorySessionStore(session)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              details: null,
              message: 'Expired access token',
              requestId: 'req-1',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              accessToken: 'new-access-token',
              refreshToken: 'new-refresh-token',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              email: 'user@example.com',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetchImpl,
      sessionStore,
    })

    const data = await client.get<{ email: string }>('/profile', {
      auth: true,
    })

    expect(data).toEqual({ email: 'user@example.com' })
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(fetchImpl).toHaveBeenNthCalledWith(
      2,
      'http://localhost:3000/api/v1/auth/refresh',
      expect.objectContaining({
        body: JSON.stringify({
          refreshToken: 'old-refresh-token',
        }),
      }),
    )
    expect(fetchImpl).toHaveBeenNthCalledWith(
      3,
      'http://localhost:3000/api/v1/profile',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer new-access-token',
        }),
      }),
    )
    expect(sessionStore.get()).toEqual({
      ...session,
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    })
  })

  it('supports PUT requests with JSON bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { success: true } }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      }),
    )

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetchImpl,
      sessionStore: createMemorySessionStore(session),
    })

    await client.put<{ success: boolean }, { note: string }>('/admin/review', {
      note: 'manual review note',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/admin/review',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({
          note: 'manual review note',
        }),
      }),
    )
  })

  it('clears the session and throws a normalized error when refresh fails', async () => {
    const sessionStore = createMemorySessionStore(session)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'UNAUTHORIZED',
              details: null,
              message: 'Expired access token',
              requestId: 'req-1',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: 'INVALID_REFRESH',
              details: null,
              message: 'Refresh token expired',
              requestId: 'req-2',
            },
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )

    const client = createApiClient({
      baseUrl: 'http://localhost:3000/api/v1',
      fetchImpl,
      sessionStore,
    })

    await expect(
      client.get('/profile', {
        auth: true,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_REFRESH',
      message: 'Refresh token expired',
      status: 401,
    })

    expect(sessionStore.get()).toBeNull()
  })
})
