// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HomepageBannerCarousel } from './homepage-banner-carousel'

describe('HomepageBannerCarousel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('autoplays multi-banner carousels and updates the active dot', () => {
    render(
      <HomepageBannerCarousel
        banners={[
          {
            height: 500,
            id: 'banner-1',
            imageUrl: '/api/v1/public/homepage-banners/banner-1.png',
            sortOrder: 0,
            width: 1600,
          },
          {
            height: 500,
            id: 'banner-2',
            imageUrl: '/api/v1/public/homepage-banners/banner-2.png',
            sortOrder: 1,
            width: 1600,
          },
        ]}
        fallback={<div>Legacy banner</div>}
      />,
    )

    expect(screen.getByRole('img', { name: 'Banner 1' })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(screen.getByRole('img', { name: 'Banner 2' })).toBeTruthy()
    expect(screen.getByLabelText('Banner 2 đang hiển thị')).toBeTruthy()
  })

  it('hides dots for a single banner and falls back after image errors', () => {
    render(
      <HomepageBannerCarousel
        banners={[
          {
            height: 500,
            id: 'banner-1',
            imageUrl: '/api/v1/public/homepage-banners/banner-1.png',
            sortOrder: 0,
            width: 1600,
          },
        ]}
        fallback={<div>Legacy banner</div>}
      />,
    )

    const image = screen.getByRole('img', { name: 'Banner 1' })
    expect(screen.queryByLabelText(/đang hiển thị/i)).toBeNull()

    fireEvent.error(image)

    expect(screen.getByText('Legacy banner')).toBeTruthy()
  })

  it('supports touch swipes to move between banners', () => {
    render(
      <HomepageBannerCarousel
        banners={[
          {
            height: 500,
            id: 'banner-1',
            imageUrl: '/api/v1/public/homepage-banners/banner-1.png',
            sortOrder: 0,
            width: 1600,
          },
          {
            height: 500,
            id: 'banner-2',
            imageUrl: '/api/v1/public/homepage-banners/banner-2.png',
            sortOrder: 1,
            width: 1600,
          },
        ]}
        fallback={<div>Legacy banner</div>}
      />,
    )

    const carousel = screen.getByTestId('homepage-banner-carousel')
    fireEvent.touchStart(carousel, {
      changedTouches: [{ clientX: 240 }],
      touches: [{ clientX: 240 }],
    })
    fireEvent.touchEnd(carousel, {
      changedTouches: [{ clientX: 120 }],
    })

    expect(screen.getByRole('img', { name: 'Banner 2' })).toBeTruthy()
  })
})
