import type {
  DisplaySettings,
  DepositRequest,
  DepositReservation,
  FinancialSettings,
  SelectedDepositBankAccount,
  WalletLedger,
  WalletSummary,
  WithdrawalDestinationDetails,
  WithdrawalRequest,
} from '#/lib/types'
import { apiClient } from '#/lib/api/app-client'
import { createIdempotencyKey } from '#/lib/utils/idempotency'

type CreateDepositInput = {
  amount: string
  assetCode: string
  destinationRef?: string
  externalReference?: string
  method: string
  note?: string
  proofUrl?: string
}

type CreateWithdrawalInput = {
  amount: string
  assetCode: string
  currentPassword: string
  destinationDetails?: WithdrawalDestinationDetails
  method: string
  note?: string
}

type CreateDepositReservationInput = {
  amount: string
  assetCode: string
  method: string
}

export const walletApi = {
  createDeposit: (input: CreateDepositInput) =>
    apiClient.post<
      {
        amount: string
        assetCode: string
        id: string
        selectedBankAccount?: SelectedDepositBankAccount | null
        status: string
      },
      CreateDepositInput
    >('/deposits', input, {
      auth: true,
      headers: {
        'Idempotency-Key': createIdempotencyKey('deposit'),
      },
    }),
  createDepositReservation: (input: CreateDepositReservationInput) =>
    apiClient.post<DepositReservation, CreateDepositReservationInput>(
      '/deposit-reservations',
      input,
      { auth: true },
    ),
  listDepositReservations: () =>
    apiClient.get<DepositReservation[]>('/deposit-reservations', {
      auth: true,
    }),
  getCurrentDepositReservation: () =>
    apiClient.get<DepositReservation | null>('/deposit-reservations/current', {
      auth: true,
    }),
  getFinancialSettings: () =>
    apiClient.get<FinancialSettings>('/settings/financial', {
      auth: true,
    }),
  getDisplaySettings: () => apiClient.get<DisplaySettings>('/settings/display'),
  createWithdrawal: (input: CreateWithdrawalInput) =>
    apiClient.post<
      {
        amount: string
        assetCode: string
        feeAmount: string
        id: string
        status: string
        totalDebit: string
      },
      CreateWithdrawalInput
    >('/withdrawals', input, {
      auth: true,
      headers: {
        'Idempotency-Key': createIdempotencyKey('withdrawal'),
      },
    }),
  confirmDepositReservation: (reservationId: string) =>
    apiClient.post<
      {
        amount: string
        assetCode: string
        id: string
        selectedBankAccount?: SelectedDepositBankAccount | null
        status: string
      },
      Record<string, never>
    >(`/deposit-reservations/${reservationId}/confirm`, {}, { auth: true }),
  cancelDepositReservation: (reservationId: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/deposit-reservations/${reservationId}/cancel`,
      {},
      { auth: true },
    ),
  cancelDeposit: (depositId: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/deposits/${depositId}/cancel`,
      {},
      { auth: true },
    ),
  cancelWithdrawal: (withdrawalId: string) =>
    apiClient.post<{ success: boolean }, Record<string, never>>(
      `/withdrawals/${withdrawalId}/cancel`,
      {},
      { auth: true },
    ),
  getLedger: (assetCode: string) =>
    apiClient.get<WalletLedger>(`/wallets/${assetCode}/ledger`, { auth: true }),
  listDeposits: () => apiClient.get<DepositRequest[]>('/deposits', { auth: true }),
  listWallets: () => apiClient.get<WalletSummary[]>('/wallets', { auth: true }),
  listWithdrawals: () =>
    apiClient.get<WithdrawalRequest[]>('/withdrawals', { auth: true }),
}
