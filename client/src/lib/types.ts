export type ApiEnvelope<T> = {
  data: T
}

export type ApiErrorEnvelope = {
  error: {
    code?: string
    details?: unknown
    message: string
    requestId?: string
  }
}

export type AuthUser = {
  email: string
  id: string
  roles: string[]
}

export type AuthSession = {
  accessToken: string
  refreshToken: string
  user: AuthUser
}

export type WalletSummary = {
  assetCode: string
  assetName: string
  walletId: string
  balances: {
    available: string
    pending: string
    total: string
  }
}

export type NotificationType =
  | 'deposit.approved'
  | 'deposit.rejected'
  | 'exchange.completed'
  | 'exchange.reversed'
  | 'withdrawal.approved'
  | 'withdrawal.rejected'

export type NotificationAmountTone = 'minus' | 'neutral' | 'plus'

export type NotificationItem = {
  createdAt: string
  id: string
  primaryAmount: string
  primaryAmountTone: NotificationAmountTone
  primaryAssetCode: string
  referenceId: string
  referenceType: string
  secondaryText: string
  title: string
  type: NotificationType
}

export type NotificationListResponse = {
  items: NotificationItem[]
  unreadCount: number
}

export type ReadAllNotificationsResponse = {
  count: number
  readAt: string | null
}

export type UnreadCountResponse = {
  count: number
}

export type Profile = {
  email: string
  id: string
  phone: string | null
  roles: string[]
  telegram: string | null
  twoFactorEnabled: boolean
}

export type DepositRequest = {
  amount: string
  assetCode: string
  approvedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  destinationRef?: string | null
  externalReference?: string | null
  id: string
  method: string
  note?: string | null
  proofUrl?: string | null
  rejectedAt?: string | null
  reviewNote?: string | null
  selectedBankAccount?: SelectedDepositBankAccount | null
  status: string
}

export type DepositReservation = {
  amount: string
  assetCode: string
  confirmedAt?: string | null
  depositRequestId?: string | null
  depositStatus?: string | null
  expiresAt: string
  reservationId: string
  selectedBankAccount?: SelectedDepositBankAccount | null
  status:
    | 'active'
    | 'pending_review'
    | 'approved'
    | 'rejected'
    | 'expired'
    | 'cancelled'
    | string
  transferContent: string
}

export type WithdrawalRequest = {
  amount: string
  assetCode: string
  approvedAt?: string | null
  cancelledAt?: string | null
  createdAt: string
  destinationDetails?: WithdrawalDestinationDetails | null
  feeAmount?: string | null
  feeProfitVnd?: string | null
  id: string
  method: string
  note?: string | null
  profitFxRateVnd?: string | null
  rejectedAt?: string | null
  reviewNote?: string | null
  status: string
  totalDebit?: string | null
}

export type WithdrawalDestinationDetails =
  | {
      accountName: string
      accountNumber: string
      bankName: string
      method: 'bank_transfer'
    }
  | {
      method: 'bep20'
      network: string
      walletAddress: string
    }
  | {
      method: 'trc20'
      network: string
      walletAddress: string
    }
  | {
      method: string
      [key: string]: unknown
    }

export type AdminReviewInput = {
  note?: string
}

export type AdminDepositRequest = DepositRequest & {
  bankAccountId?: string | null
  destinationRef?: string | null
  externalReference?: string | null
  proofUrl?: string | null
  userEmail?: string | null
  userId?: string
  userPhone?: string | null
}

export type AdminWithdrawalRequest = WithdrawalRequest & {
  userEmail?: string | null
  userId?: string
  userPhone?: string | null
}

export type WalletLedgerEntry = {
  amount?: string
  amountMinor: string
  bucket: string
  createdAt: string
  direction: string
  id: string
  note: string | null
  referenceId: string
  referenceType: string
}

export type WalletLedger = {
  entries: WalletLedgerEntry[]
  wallet: {
    assetCode: string
    balances: WalletSummary['balances']
  }
}

export type ExchangeQuote = {
  expiresAt: string
  feeAmount: string
  feeAssetCode: string
  feeBps: number
  fromAmount: string
  fromAssetCode: string
  grossReceiveAmount: string
  id: string
  rate: string
  requestedAmount: string
  roundingMode: string
  toAmount: string
  toAssetCode: string
  totalDebit: string
}

export type ExchangeOrderSummary = {
  createdAt: string
  feeAmount: string
  feeAssetCode: string
  fromAssetCode: string
  grossReceiveAmount: string
  id: string
  rate: string
  requestedAmount: string
  reversedAt?: string | null
  roundingMode: string
  status: string
  toAmount: string
  toAssetCode: string
  totalDebit: string
}

export type AdminExchangeOrder = {
  appliedMarkupVnd: number
  createdAt: string
  feeAmount: string
  feeAssetCode: string
  feeBps: number
  feeProfitVnd: string
  fromAssetCode: string
  grossReceiveAmount: string
  id: string
  markupProfitVnd: string
  rate: string
  realtimeRateVnd: string
  requestedAmount: string
  reversedAt?: string | null
  status: 'completed' | 'reversed'
  toAmount: string
  toAssetCode: string
  totalDebit: string
  userEmail: string
  userId: string
  userPhone?: string | null
}

export type HomepageBanner = {
  height: number
  id: string
  imageUrl: string
  sortOrder: number
  width: number
}

export type DisplaySettings = {
  homepageBanners: HomepageBanner[]
  supportLink: string
}

export type FrontendDisplayConfig = DisplaySettings

export type SelectedDepositBankAccount = {
  accountName: string
  accountNumber: string
  bankCode: string
  bankName: string
  id: string
  priority: number
}

export type AdminBankAccount = {
  accountName: string
  accountNumber: string
  approvedTotal: string
  bankCode: string
  bankName: string
  canDelete: boolean
  createdAt: string
  dailyLimit: string
  id: string
  isActive: boolean
  liveReservationCount: number
  pendingDepositCount: number
  priority: number
  remainingToday: string
  reservedPendingReview: string
  reservedUnconfirmed: string
  updatedAt: string
  usedToday: string
}

export type CreateBankAccountInput = {
  accountName: string
  accountNumber: string
  bankCode: string
  bankName: string
  dailyLimit: string
  isActive: boolean
  priority: number
}

export type UpdateBankAccountInput = CreateBankAccountInput

export type FinancialSettings = {
  exchangeUsdtToVndFeeBps: number
  exchangeUsdtToVndMarkupVnd: number
  exchangeVndToUsdtFeeBps: number
  exchangeVndToUsdtMarkupVnd: number
  withdrawalUsdtFeeBps: number
  withdrawalVndFeeBps: number
}

export type UpdateAdminSettingsInput = FinancialSettings & {
  depositReservationTtlMinutes: number
  supportLink: string
}

export type AdminSettings = UpdateAdminSettingsInput & {
  homepageBanners: HomepageBanner[]
}

export type TelegramRuntimeConfigSummary = {
  botUsername: string | null
  chatId: string
  configured: boolean
  lastValidatedAt: string | null
  tokenSuffix: string | null
  updatedAt: string | null
  version: number | null
}

export type UpdateTelegramRuntimeConfigInput = {
  chatId: string
  token?: string
}

export type AdminUserBalances = {
  usdt: {
    available: string
    pending: string
    total: string
  }
  vnd: {
    available: string
    pending: string
    total: string
  }
}

export type AdminUserSummary = {
  balances: AdminUserBalances
  createdAt: string
  email: string
  id: string
  phone: string | null
  roles: string[]
  telegram: string | null
  twoFactorEnabled: boolean
  totals: {
    totalDepositUsdt: string
    totalDepositVnd: string
    totalWithdrawUsdt: string
    totalWithdrawVnd: string
  }
}

export type AdminRoleOption = {
  code: string
  id: string
  name: string
}

export type UpdateAdminUserProfileInput = {
  email?: string
  phone?: string
  telegram?: string
}

export type UpdateAdminUserRolesInput = {
  roles: string[]
}

export type UpdateAdminUserPasswordInput = {
  newPassword: string
}

export type OverwriteAdminUserBalancesInput = {
  usdt?: string
  vnd?: string
}

export type AddAdminUserBalanceInput = {
  amount: string
  assetCode: 'VND' | 'USDT'
}

export type VietQrBankOption = {
  bin: string
  code: string
  id: number
  logo?: string
  name: string
  shortName: string
  transferSupported?: number
}
