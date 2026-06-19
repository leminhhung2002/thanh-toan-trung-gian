// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ManualRefreshButton } from './manual-refresh-button'
import styles from '../../routes/admin.module.css'

describe('ManualRefreshButton', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders the idle refresh label with shared admin styling and handles clicks', () => {
    const onClick = vi.fn()

    render(<ManualRefreshButton isRefreshing={false} onClick={onClick} />)

    const button = screen.getByRole('button', { name: /làm mới/i })
    fireEvent.click(button)

    expect(button.className).toContain(styles.refreshBtn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders the loading label while refreshing', () => {
    render(<ManualRefreshButton isRefreshing onClick={() => {}} />)

    expect(
      screen.getByRole('button', { name: /đang tải/i }),
    ).toHaveProperty('disabled', true)
  })

  it('merges an extra class name without losing the shared refresh button styling', () => {
    render(
      <ManualRefreshButton
        className="custom-refresh"
        isRefreshing={false}
        onClick={() => {}}
      />,
    )

    const button = screen.getByRole('button', { name: /làm mới/i })

    expect(button.className).toContain(styles.refreshBtn)
    expect(button.className).toContain('custom-refresh')
  })
})
