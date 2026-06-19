// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WithdrawAmountField } from './withdraw-amount-field'

describe('WithdrawAmountField', () => {
  it('uses a filled hover state so the MAX label stays visible', () => {
    const stylesheet = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        '../../routes/dashboard.module.css',
      ),
      'utf8',
    )

    expect(stylesheet).toMatch(
      /\.maxBtn:focus-visible,\s*\.maxBtn:hover\s*{[^}]*background:\s*#f26622;/s,
    )
    expect(stylesheet).toMatch(
      /\.maxBtn:focus-visible,\s*\.maxBtn:hover\s*{[^}]*color:\s*#ffffff;/s,
    )
  })

  it('renders the fee hint above the input and exposes a MAX action', () => {
    const onChange = vi.fn()
    const onMax = vi.fn()
    const { container } = render(
      <WithdrawAmountField
        feeHint="Phí rút 10%: 2.500 VND"
        label="Số tiền bạn muốn rút (VND)"
        onChange={onChange}
        onMax={onMax}
        value="25000"
      />,
    )

    const header = screen.getByTestId('withdraw-amount-header')
    expect(header.children).toHaveLength(2)
    expect(header.firstElementChild?.textContent).toBe('Số tiền bạn muốn rút (VND)')
    expect(header.lastElementChild?.textContent).toBe('Phí rút 10%: 2.500 VND')

    const input = container.querySelector('input')
    expect(input).toBeTruthy()
    expect(
      header.compareDocumentPosition(input as Node) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    fireEvent.change(input as HTMLInputElement, { target: { value: '35000' } })
    expect(onChange).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'MAX' }))
    expect(onMax).toHaveBeenCalled()
  })
})
