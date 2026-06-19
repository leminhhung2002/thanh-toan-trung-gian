// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DrawerBalances } from './drawer-balances'

describe('DrawerBalances', () => {
  it('renders compact balance pills for both VND and USDT instead of wide option-like cards', () => {
    const { container } = render(
      <DrawerBalances
        usdtAvailable="122"
        vndAvailable="100001"
      />,
    )

    expect(screen.getByText('100.001 VNĐ')).toBeTruthy()
    expect(screen.getByText('122.00 USDT')).toBeTruthy()

    expect((container.firstElementChild as HTMLElement | null)?.style.justifyContent).toBe(
      'flex-end',
    )

    const pills = container.querySelectorAll('[data-balance-pill="true"]')
    expect(pills).toHaveLength(2)
    expect(container.querySelector('[data-balance-grid="true"]')).toBeNull()
  })
})
