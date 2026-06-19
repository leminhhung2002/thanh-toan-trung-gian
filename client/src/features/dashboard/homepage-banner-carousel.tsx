import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { HomepageBanner } from '#/lib/types'
import { resolveAssetUrl } from '#/lib/utils/asset-url'
import styles from '../../routes/dashboard.module.css'

type HomepageBannerCarouselProps = {
  banners: HomepageBanner[]
  fallback: ReactNode
}

const AUTOPLAY_INTERVAL_MS = 5000
const SWIPE_THRESHOLD_PX = 30

export function HomepageBannerCarousel(props: HomepageBannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [failedBannerIds, setFailedBannerIds] = useState<string[]>([])
  const touchStartXRef = useRef<number | null>(null)

  const availableBanners = useMemo(
    () =>
      props.banners.filter((banner) => !failedBannerIds.includes(banner.id)),
    [failedBannerIds, props.banners],
  )

  useEffect(() => {
    if (availableBanners.length === 0) {
      return
    }

    setActiveIndex((currentIndex) =>
      currentIndex >= availableBanners.length ? 0 : currentIndex,
    )
  }, [availableBanners.length])

  useEffect(() => {
    if (availableBanners.length <= 1) {
      return
    }

    const intervalId = window.setInterval(() => {
      setActiveIndex((currentIndex) =>
        (currentIndex + 1) % availableBanners.length,
      )
    }, AUTOPLAY_INTERVAL_MS)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [availableBanners.length])

  if (availableBanners.length === 0) {
    return props.fallback
  }

  const activeBanner = availableBanners[activeIndex]

  const moveBanner = (direction: 'next' | 'prev') => {
    if (availableBanners.length <= 1) {
      return
    }

    setActiveIndex((currentIndex) => {
      if (direction === 'next') {
        return (currentIndex + 1) % availableBanners.length
      }

      return (currentIndex - 1 + availableBanners.length) % availableBanners.length
    })
  }

  return (
    <div
      className={styles.bannerCarousel}
      data-testid="homepage-banner-carousel"
      onTouchEnd={(event) => {
        const startX = touchStartXRef.current
        const endX = event.changedTouches[0]?.clientX ?? null

        touchStartXRef.current = null

        if (startX === null || endX === null) {
          return
        }

        const deltaX = startX - endX

        if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) {
          return
        }

        moveBanner(deltaX > 0 ? 'next' : 'prev')
      }}
      onTouchStart={(event) => {
        touchStartXRef.current = event.touches[0]?.clientX ?? null
      }}
    >
      <div className={styles.bannerMediaFrame}>
        <img
          alt={`Banner ${activeIndex + 1}`}
          className={styles.bannerImage}
          onError={() => {
            setFailedBannerIds((currentIds) =>
              currentIds.includes(activeBanner.id)
                ? currentIds
                : [...currentIds, activeBanner.id],
            )
          }}
          src={resolveAssetUrl(activeBanner.imageUrl)}
        />
      </div>

      {availableBanners.length > 1 ? (
        <div className={styles.dots}>
          {availableBanners.map((banner, index) => (
            <button
              key={banner.id}
              aria-label={
                index === activeIndex
                  ? `Banner ${index + 1} đang hiển thị`
                  : `Chuyển sang banner ${index + 1}`
              }
              className={`${styles.dot} ${index === activeIndex ? styles.active : ''}`}
              onClick={() => setActiveIndex(index)}
              type="button"
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
