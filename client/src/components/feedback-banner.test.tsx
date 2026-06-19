// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { FeedbackBanner } from './feedback-banner'

describe('FeedbackBanner', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders success copy with a matching status class', () => {
    render(<FeedbackBanner kind="success" message="Đã cập nhật thành công." />)

    const banner = screen.getByRole('status')

    expect(banner).toBeTruthy()
    expect(screen.getByText('Đã cập nhật thành công.')).toBeTruthy()
  })

  it('renders error copy with a matching status class', () => {
    render(<FeedbackBanner kind="error" message="Không thể xử lý yêu cầu." />)

    const banner = screen.getByRole('status')

    expect(banner).toBeTruthy()
    expect(screen.getByText('Không thể xử lý yêu cầu.')).toBeTruthy()
  })
})
