// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AdminBankAccount, VietQrBankOption } from '#/lib/types'
import { BankAccountsSection } from './admin-page'

function createBankAccount(
  overrides: Partial<AdminBankAccount> = {},
): AdminBankAccount {
  return {
    accountName: 'NGAN LUONG',
    accountNumber: '123456789',
    approvedTotal: '0',
    bankCode: '970436',
    bankName: 'Vietcombank',
    canDelete: true,
    createdAt: '2026-04-05T00:00:00.000Z',
    dailyLimit: '1000000',
    id: 'bank-1',
    isActive: true,
    liveReservationCount: 0,
    pendingDepositCount: 0,
    priority: 1,
    remainingToday: '1000000',
    reservedPendingReview: '0',
    reservedUnconfirmed: '0',
    updatedAt: '2026-04-05T00:00:00.000Z',
    usedToday: '0',
    ...overrides,
  }
}

function createBankOption(
  overrides: Partial<VietQrBankOption> = {},
): VietQrBankOption {
  return {
    bin: '970436',
    code: 'VCB',
    id: 43,
    name: 'Ngân hàng TMCP Ngoại thương Việt Nam',
    shortName: 'Vietcombank',
    transferSupported: 1,
    ...overrides,
  }
}

function renderSection(options: {
  bankAccounts?: AdminBankAccount[]
  bankForm?: {
    accountName: string
    accountNumber: string
    bankCode: string
    bankName: string
    dailyLimit: string
    isActive: boolean
    priority: string
  }
  bankOptions?: VietQrBankOption[]
  editingBankId?: string | null
}) {
  render(
    <BankAccountsSection
      bankAccounts={options.bankAccounts ?? []}
      bankFeedback={null}
      bankForm={
        options.bankForm ?? {
          accountName: 'NGAN LUONG',
          accountNumber: '123456789',
          bankCode: '970436',
          bankName: 'Vietcombank',
          dailyLimit: '1000000',
          isActive: true,
          priority: '1',
        }
      }
      bankOptions={options.bankOptions ?? [createBankOption()]}
      bankOptionsPending={false}
      editingBankId={options.editingBankId ?? null}
      isDeleting={false}
      isPending={false}
      isRefreshing={false}
      isResetting={false}
      isSubmitting={false}
      onDelete={vi.fn(async () => {})}
      onFormChange={vi.fn()}
      onOpenEdit={vi.fn()}
      onRefresh={vi.fn()}
      onResetUsage={vi.fn(async () => {})}
      onSubmit={vi.fn()}
      onToggleActive={vi.fn()}
      onCancelForm={vi.fn()}
    />,
  )
}

describe('BankAccountsSection', () => {
  afterEach(() => {
    cleanup()
  })

  it('keeps only one add-bank action and uses a separate form reset label', () => {
    renderSection({
      bankAccounts: [createBankAccount()],
    })

    expect(
      screen.getAllByRole('button', { name: 'Thêm ngân hàng' }),
    ).toHaveLength(1)
    expect(screen.getAllByRole('button', { name: 'Làm mới' })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Làm trống' })).toBeTruthy()
  })

  it('shows a cancel-edit label instead of a generic refresh action while editing', () => {
    renderSection({
      editingBankId: 'bank-1',
      bankAccounts: [createBankAccount()],
    })

    expect(screen.getByRole('button', { name: 'Hủy chỉnh sửa' })).toBeTruthy()
  })

  it('selects the supported VietQR bank while editing', () => {
    renderSection({
      editingBankId: 'bank-1',
      bankAccounts: [createBankAccount()],
    })

    const select = screen.getByLabelText('Ngân hàng VietQR') as HTMLSelectElement

    expect(select.value).toBe('970436')
    expect(screen.getByRole('option', { name: 'Vietcombank (970436)' })).toBeTruthy()
  })

  it('keeps a legacy bank visible while editing even when it is not in the supported list', () => {
    renderSection({
      editingBankId: 'bank-legacy',
      bankAccounts: [
        createBankAccount({
          bankCode: '999999',
          bankName: 'Legacy Bank',
          id: 'bank-legacy',
        }),
      ],
      bankForm: {
        accountName: 'NGAN LUONG',
        accountNumber: '123456789',
        bankCode: '999999',
        bankName: 'Legacy Bank',
        dailyLimit: '1000000',
        isActive: true,
        priority: '1',
      },
      bankOptions: [createBankOption()],
    })

    const select = screen.getByLabelText('Ngân hàng VietQR') as HTMLSelectElement

    expect(select.value).toBe('999999')
    expect(screen.getByRole('option', { name: 'Legacy Bank (999999)' })).toBeTruthy()
  })

  it('shows the cumulative approved deposit total separately from daily usage', () => {
    renderSection({
      bankAccounts: [
        createBankAccount({
          approvedTotal: '3500000',
          usedToday: '150000',
        }),
      ],
    })

    expect(screen.getByText('Tổng đã duyệt')).toBeTruthy()
    expect(screen.getByText('3.500.000 đ')).toBeTruthy()
    expect(screen.getAllByText('150.000 đ')).toHaveLength(2)
  })
})
