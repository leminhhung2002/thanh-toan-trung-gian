import { type ReactNode, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useNavigate } from '@tanstack/react-router'
import { FeedbackBanner } from '#/components/feedback-banner'
import { ScreenLoader } from '#/components/screen-loader'
import type { AdminStatusFilter } from '#/features/admin/api'
import { adminApi } from '#/features/admin/api'
import {
  formatFeePercentInputFromBps,
  parseFeePercentInputToBps,
} from '#/features/admin/fee-percent'
import {
  getCapacityPercent,
  getConsumedCapacity,
} from '#/features/admin/bank-account-metrics'
import {
  AdminDateFilter,
  getAdminDateRangeError,
  getNextEffectiveAdminDateRange,
  type AdminDateRange,
  shouldShowAdminDateFilter,
} from '#/features/admin/date-filter'
import { ManualRefreshButton } from '#/features/admin/manual-refresh-button'
import { buildAdminOverviewMetrics } from '#/features/admin/overview'
import { getAdminPollingOptions } from '#/features/admin/polling'
import { shouldShowRestorePendingAction } from '#/features/admin/review-actions'
import {
  buildReviewInvalidationKeys,
  getNextBankPriority,
  normalizeReviewNote,
} from '#/features/admin/shell-state'
import {
  getDepositReviewUiCopy,
  getWithdrawalReviewUiCopy,
} from '#/features/admin/review-ui'
import { AdminWithdrawalQrCard } from '#/features/admin/withdrawal-qr'
import { UsersSection } from '#/features/admin/users-section'
import {
  findVietQrBank,
  getBankOptionsForForm,
  listVietQrBanks,
} from '#/features/admin/vietqr-banks'
import {
  adminStatusFilterOrder,
  adminStatusLabels,
  defaultAdminStatusFilter,
  getVisibleAdminTabs,
} from '#/features/admin/ui'
import type { LegacyAdminTabId } from '#/features/admin/ui'
import { authApi, toSession } from '#/features/auth/api'
import { translateApiError } from '#/lib/api/error-copy'
import { useAuthSession } from '#/lib/auth/auth-context'
import { requireAdminRole } from '#/lib/auth/guards'
import { queryKeys } from '#/lib/query-keys'
import type {
  AdminBankAccount,
  AdminExchangeOrder,
  HomepageBanner,
  UpdateTelegramRuntimeConfigInput,
  UpdateAdminSettingsInput,
  UpdateBankAccountInput,
  VietQrBankOption,
  WithdrawalDestinationDetails,
} from '#/lib/types'
import { resolveAssetUrl } from '#/lib/utils/asset-url'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import styles from '../../routes/admin.module.css'

type BankFormValues = {
  accountName: string
  accountNumber: string
  bankCode: string
  bankName: string
  dailyLimit: string
  isActive: boolean
  priority: string
}

type FeedbackState = {
  kind: 'error' | 'success'
  message: string
}

function getStatusLabel(status: string) {
  if (status === 'reversed') {
    return 'Đã khôi phục'
  }

  if (status === 'completed') {
    return 'Hoàn tất'
  }

  if (status in adminStatusLabels) {
    return adminStatusLabels[status as AdminStatusFilter]
  }

  return status
}

function createEmptyBankForm(priority = '1'): BankFormValues {
  return {
    accountName: '',
    accountNumber: '',
    bankCode: '',
    bankName: '',
    dailyLimit: '',
    isActive: true,
    priority,
  }
}

function getTodayInVietnamIsoDate() {
  return new Date().toLocaleDateString('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
}

function createTodayAdminDateRange(): AdminDateRange {
  const today = getTodayInVietnamIsoDate()

  return {
    fromDate: today,
    toDate: today,
  }
}

function toBankFormValues(bank: AdminBankAccount): BankFormValues {
  return {
    accountName: bank.accountName,
    accountNumber: bank.accountNumber,
    bankCode: bank.bankCode,
    bankName: bank.bankName,
    dailyLimit: bank.dailyLimit,
    isActive: bank.isActive,
    priority: String(bank.priority),
  }
}

function buildAdminUserMetaLine(input: {
  createdAt: string
  userEmail?: string | null
  userPhone?: string | null
}) {
  return [input.userEmail, input.userPhone, new Date(input.createdAt).toLocaleString('vi-VN')]
    .filter((value) => Boolean(value))
    .join(' · ')
}

export function AdminPage() {
  const { hydrated, session } = useAuthSession()

  if (!hydrated) {
    return <ScreenLoader />
  }

  if (!session) {
    return <AdminLoginScreen />
  }

  if (!requireAdminRole(session)) {
    return <Navigate to="/dashboard" replace />
  }

  return <AdminShell />
}

function AdminLoginScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setSession } = useAuthSession()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.email.trim() || !value.password.trim()) {
        setError('Vui lòng nhập Email và mật khẩu quản trị.')
        return
      }

      setError('')

      try {
        const result = await authApi.login({
          email: value.email.trim(),
          password: value.password,
        })

        const nextSession = toSession(result)
        setSession(nextSession)
        queryClient.setQueryData(queryKeys.wallets, result.wallets)

        const me = await authApi.me()
        queryClient.setQueryData(queryKeys.authMe, me)
        queryClient.setQueryData(queryKeys.profile, me)

        const hydratedSession = {
          ...nextSession,
          user: {
            email: me.email,
            id: me.id,
            roles: me.roles,
          },
        }

        setSession(hydratedSession)

        if (requireAdminRole(hydratedSession)) {
          await navigate({ to: '/adminxxx' })
          return
        }

        await navigate({ to: '/dashboard' })
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : 'Đăng nhập thất bại',
        )
      }
    },
  })

  return (
    <div className={styles.loginPage}>
      <form
        className={styles.loginBox}
        onSubmit={(event) => {
          event.preventDefault()
          event.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <div className={styles.loginLogo}>
          <i className="fas fa-shield-alt" />
        </div>
        <h1 className={styles.loginTitle}>ADMIN PANEL</h1>
        <p className={styles.loginSub}>Hệ thống quản trị nội bộ</p>
        {error ? (
          <div className={styles.loginErr}>
            <i className="fas fa-exclamation-circle" /> {error}
          </div>
        ) : null}

        <form.Field name="email">
          {(field) => (
            <div className={styles.loginField}>
              <i className="fas fa-envelope" />
              <input
                type="email"
                placeholder="Email quản trị"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setError('')
                  field.handleChange(event.target.value)
                }}
              />
            </div>
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <div className={styles.loginField}>
              <i className="fas fa-lock" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Mật khẩu"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setError('')
                  field.handleChange(event.target.value)
                }}
              />
              <button
                className={`fas ${showPassword ? 'fa-eye' : 'fa-eye-slash'} ${styles.eyeBtn}`}
                onClick={() => setShowPassword((value) => !value)}
                type="button"
              ></button>
            </div>
          )}
        </form.Field>

        <button className={styles.loginSubmit} type="submit">
          <i className="fas fa-sign-in-alt" /> ĐĂNG NHẬP
        </button>
      </form>
    </div>
  )
}

function AdminShell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clearSession, session } = useAuthSession()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<LegacyAdminTabId>('overview')
  const [statusFilter, setStatusFilter] = useState<AdminStatusFilter>(
    defaultAdminStatusFilter,
  )
  const [dateRange, setDateRange] = useState<AdminDateRange>(createTodayAdminDateRange)
  const [effectiveDateRange, setEffectiveDateRange] = useState<AdminDateRange>(
    createTodayAdminDateRange,
  )
  const [depositNotes, setDepositNotes] = useState<Partial<Record<string, string>>>({})
  const [withdrawalNotes, setWithdrawalNotes] = useState<
    Partial<Record<string, string>>
  >({})
  const [depositSearch, setDepositSearch] = useState('')
  const [withdrawalSearch, setWithdrawalSearch] = useState('')
  const [exchangeSearch, setExchangeSearch] = useState('')
  const [bankFeedback, setBankFeedback] = useState<FeedbackState | null>(null)
  const [bankEditingId, setBankEditingId] = useState<string | null>(null)
  const [bankForm, setBankForm] = useState<BankFormValues>(createEmptyBankForm())
  const [reviewFeedback, setReviewFeedback] = useState<FeedbackState | null>(null)
  const [settingsFeedback, setSettingsFeedback] = useState<FeedbackState | null>(null)
  const [telegramRuntimeFeedback, setTelegramRuntimeFeedback] = useState<FeedbackState | null>(null)
  const [bannerFeedback, setBannerFeedback] = useState<FeedbackState | null>(null)
  const [reservationTtlInput, setReservationTtlInput] = useState('15')
  const [exchangeUsdtToVndFeeBpsInput, setExchangeUsdtToVndFeeBpsInput] = useState(
    formatFeePercentInputFromBps(50),
  )
  const [exchangeUsdtToVndMarkupVndInput, setExchangeUsdtToVndMarkupVndInput] = useState('700')
  const [exchangeVndToUsdtFeeBpsInput, setExchangeVndToUsdtFeeBpsInput] = useState(
    formatFeePercentInputFromBps(100),
  )
  const [exchangeMarkupVndInput, setExchangeMarkupVndInput] = useState('1000')
  const [supportLinkInput, setSupportLinkInput] = useState(
    'https://t.me/nganluong_support',
  )
  const [telegramRuntimeChatIdInput, setTelegramRuntimeChatIdInput] = useState('')
  const [telegramRuntimeTokenInput, setTelegramRuntimeTokenInput] = useState('')
  const [withdrawalVndFeeBpsInput, setWithdrawalVndFeeBpsInput] = useState(
    formatFeePercentInputFromBps(1000),
  )
  const [withdrawalUsdtFeeBpsInput, setWithdrawalUsdtFeeBpsInput] = useState(
    formatFeePercentInputFromBps(0),
  )
  const adminDepositsPolling = getAdminPollingOptions({
    activeTab,
    targetTab: 'transactions',
  })
  const adminWithdrawalsPolling = getAdminPollingOptions({
    activeTab,
    targetTab: 'withdrawals',
  })
  const adminExchangePolling = getAdminPollingOptions({
    activeTab,
    targetTab: 'exchange',
  })
  const adminBankAccountsPolling = getAdminPollingOptions({
    activeTab,
    targetTab: 'banks',
  })
  const deferredDepositSearch = useDeferredValue(depositSearch.trim())
  const deferredWithdrawalSearch = useDeferredValue(withdrawalSearch.trim())
  const deferredExchangeSearch = useDeferredValue(exchangeSearch.trim())
  const dateRangeError = getAdminDateRangeError(dateRange)
  const queryFromDate = effectiveDateRange.fromDate
  const queryToDate = effectiveDateRange.toDate
  const exchangeSearchQuery = activeTab === 'exchange' ? deferredExchangeSearch : ''

  useEffect(() => {
    setEffectiveDateRange((current) =>
      getNextEffectiveAdminDateRange(current, dateRange),
    )
  }, [dateRange])

  const adminDepositsQuery = useQuery({
    queryKey: queryKeys.adminDeposits(
      statusFilter,
      queryFromDate,
      queryToDate,
      deferredDepositSearch,
    ),
    queryFn: () =>
      adminApi.listDeposits(
        statusFilter,
        queryFromDate,
        queryToDate,
        deferredDepositSearch,
      ),
    ...adminDepositsPolling,
  })
  const adminWithdrawalsQuery = useQuery({
    queryKey: queryKeys.adminWithdrawals(
      statusFilter,
      queryFromDate,
      queryToDate,
      deferredWithdrawalSearch,
    ),
    queryFn: () =>
      adminApi.listWithdrawals(
        statusFilter,
        queryFromDate,
        queryToDate,
        deferredWithdrawalSearch,
      ),
    ...adminWithdrawalsPolling,
  })
  const adminExchangeOrdersQuery = useQuery({
    queryKey: queryKeys.adminExchangeOrders(
      queryFromDate,
      queryToDate,
      exchangeSearchQuery,
    ),
    queryFn: () =>
      adminApi.listExchangeOrders(
        queryFromDate,
        queryToDate,
        exchangeSearchQuery,
      ),
    ...adminExchangePolling,
    enabled: activeTab === 'overview' || activeTab === 'exchange',
  })
  const overviewDepositsQuery = useQuery({
    queryKey: queryKeys.adminDeposits('all', queryFromDate, queryToDate),
    queryFn: () => adminApi.listDeposits('all', queryFromDate, queryToDate),
    enabled: activeTab === 'overview',
  })
  const overviewWithdrawalsQuery = useQuery({
    queryKey: queryKeys.adminWithdrawals('all', queryFromDate, queryToDate),
    queryFn: () => adminApi.listWithdrawals('all', queryFromDate, queryToDate),
    enabled: activeTab === 'overview',
  })
  const adminBankAccountsQuery = useQuery({
    queryKey: queryKeys.adminBankAccounts,
    queryFn: adminApi.listBankAccounts,
    ...adminBankAccountsPolling,
  })
  const adminUsersOverviewQuery = useQuery({
    queryKey: queryKeys.adminUsers(''),
    queryFn: () => adminApi.listUsers(''),
    enabled: activeTab === 'overview' || activeTab === 'users',
  })
  const bankOptionsQuery = useQuery({
    queryKey: queryKeys.vietQrBanks,
    queryFn: () => listVietQrBanks(),
    staleTime: 1000 * 60 * 60,
  })
  const adminSettingsQuery = useQuery({
    queryKey: queryKeys.adminSettings,
    queryFn: adminApi.getSettings,
  })
  const canManageTelegramRuntimeConfig =
    session?.user.roles.includes('super_admin') ?? false
  const visibleAdminTabs = useMemo(
    () => getVisibleAdminTabs(session?.user.roles ?? []),
    [session?.user.roles],
  )
  const telegramRuntimeConfigQuery = useQuery({
    queryKey: queryKeys.adminTelegramRuntimeConfig,
    queryFn: adminApi.getTelegramRuntimeConfig,
    enabled: canManageTelegramRuntimeConfig,
  })
  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: authApi.me,
  })

  useEffect(() => {
    if (!visibleAdminTabs.some((tab) => tab.id === activeTab)) {
      setActiveTab('overview')
    }
  }, [activeTab, visibleAdminTabs])

  const handleSelectTab = (tabId: LegacyAdminTabId) => {
    setActiveTab(tabId)
    setIsMobileSidebarOpen(false)
  }

  const invalidateReviewQueries = async () => {
    await Promise.all([
      ...buildReviewInvalidationKeys().map((queryKey) =>
        queryClient.invalidateQueries({ queryKey }),
      ),
    ])
  }

  const invalidateExchangeQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin', 'exchange', 'orders'] }),
      queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications(50) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
    ])
  }

  const invalidateBankQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.adminBankAccounts }),
      queryClient.invalidateQueries({ queryKey: ['admin', 'deposits'] }),
    ])
  }

  const invalidateSettingsQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.adminSettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.displaySettings }),
      queryClient.invalidateQueries({ queryKey: queryKeys.financialSettings }),
    ])
  }

  const reviewError = (error: unknown, fallback: string) => {
    setReviewFeedback({
      kind: 'error',
      message: translateApiError(error, fallback),
    })
  }

  const approveDepositMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.approveDeposit(id, normalizeReviewNote(note)),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã duyệt yêu cầu nạp tiền.',
      })
    },
    onError: (error) => reviewError(error, 'Duyệt nạp tiền thất bại'),
  })

  const rejectDepositMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.rejectDeposit(id, normalizeReviewNote(note)),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã từ chối yêu cầu nạp tiền.',
      })
    },
    onError: (error) => reviewError(error, 'Từ chối nạp tiền thất bại'),
  })

  const approveWithdrawalMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.approveWithdrawal(id, normalizeReviewNote(note)),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã duyệt yêu cầu rút tiền.',
      })
    },
    onError: (error) => reviewError(error, 'Duyệt rút tiền thất bại'),
  })

  const rejectWithdrawalMutation = useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      adminApi.rejectWithdrawal(id, normalizeReviewNote(note)),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã từ chối yêu cầu rút tiền.',
      })
    },
    onError: (error) => reviewError(error, 'Từ chối rút tiền thất bại'),
  })

  const restoreDepositPendingMutation = useMutation({
    mutationFn: (id: string) => adminApi.restoreDepositPending(id),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã khôi phục yêu cầu nạp tiền về chờ duyệt.',
      })
    },
    onError: (error) => reviewError(error, 'Khôi phục nạp tiền thất bại'),
  })

  const restoreWithdrawalPendingMutation = useMutation({
    mutationFn: (id: string) => adminApi.restoreWithdrawalPending(id),
    onSuccess: async () => {
      await invalidateReviewQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã khôi phục yêu cầu rút tiền về chờ duyệt.',
      })
    },
    onError: (error) => reviewError(error, 'Khôi phục rút tiền thất bại'),
  })

  const reverseExchangeOrderMutation = useMutation({
    mutationFn: (id: string) => adminApi.reverseExchangeOrder(id),
    onSuccess: async () => {
      await invalidateExchangeQueries()
      setReviewFeedback({
        kind: 'success',
        message: 'Đã khôi phục lệnh đổi tiền.',
      })
    },
    onError: (error) => reviewError(error, 'Khôi phục đổi tiền thất bại'),
  })

  const createBankAccountMutation = useMutation({
    mutationFn: (input: UpdateBankAccountInput) => adminApi.createBankAccount(input),
    onSuccess: async () => {
      await invalidateBankQueries()
      setBankFeedback({
        kind: 'success',
        message: 'Đã thêm tài khoản ngân hàng mới.',
      })
    },
    onError: (error) => {
      setBankFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể thêm tài khoản ngân hàng'),
      })
    },
  })

  const updateBankAccountMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateBankAccountInput }) =>
      adminApi.updateBankAccount(id, input),
    onSuccess: async () => {
      await invalidateBankQueries()
      setBankFeedback({
        kind: 'success',
        message: 'Đã cập nhật cấu hình tài khoản ngân hàng.',
      })
    },
    onError: (error) => {
      setBankFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể cập nhật tài khoản ngân hàng'),
      })
    },
  })

  const deleteBankAccountMutation = useMutation({
    mutationFn: (id: string) => adminApi.deleteBankAccount(id),
    onSuccess: async () => {
      await invalidateBankQueries()
      setBankFeedback({
        kind: 'success',
        message: 'Đã xoá tài khoản ngân hàng.',
      })
    },
    onError: (error) => {
      setBankFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể xoá tài khoản ngân hàng'),
      })
    },
  })

  const resetBankUsageMutation = useMutation({
    mutationFn: () => adminApi.resetBankAccountUsage(),
    onSuccess: async () => {
      await invalidateBankQueries()
      setBankFeedback({
        kind: 'success',
        message: 'Đã reset mức dùng trong ngày cho toàn bộ tài khoản.',
      })
    },
    onError: (error) => {
      setBankFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể reset mức dùng hôm nay'),
      })
    },
  })

  const updateSettingsMutation = useMutation({
    mutationFn: (input: UpdateAdminSettingsInput) => adminApi.updateSettings(input),
    onSuccess: async (result) => {
      await invalidateSettingsQueries()
      setReservationTtlInput(String(result.depositReservationTtlMinutes))
      setExchangeUsdtToVndFeeBpsInput(
        formatFeePercentInputFromBps(result.exchangeUsdtToVndFeeBps),
      )
      setExchangeUsdtToVndMarkupVndInput(String(result.exchangeUsdtToVndMarkupVnd))
      setExchangeVndToUsdtFeeBpsInput(
        formatFeePercentInputFromBps(result.exchangeVndToUsdtFeeBps),
      )
      setExchangeMarkupVndInput(String(result.exchangeVndToUsdtMarkupVnd))
      setSupportLinkInput(result.supportLink)
      setWithdrawalVndFeeBpsInput(
        formatFeePercentInputFromBps(result.withdrawalVndFeeBps),
      )
      setWithdrawalUsdtFeeBpsInput(
        formatFeePercentInputFromBps(result.withdrawalUsdtFeeBps),
      )
      setSettingsFeedback({
        kind: 'success',
        message: 'Đã cập nhật cấu hình giữ chỗ, tỷ giá, phí giao dịch và thông tin hiển thị.',
      })
    },
    onError: (error) => {
      setSettingsFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể lưu cấu hình giữ chỗ'),
      })
    },
  })

  const uploadHomepageBannerMutation = useMutation({
    mutationFn: (formData: FormData) => adminApi.uploadHomepageBanner(formData),
    onSuccess: async () => {
      await invalidateSettingsQueries()
      setBannerFeedback({
        kind: 'success',
        message: 'Đã tải banner trang chủ lên server.',
      })
    },
    onError: (error) => {
      setBannerFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể tải banner trang chủ'),
      })
    },
  })

  const reorderHomepageBannersMutation = useMutation({
    mutationFn: (bannerIds: string[]) => adminApi.reorderHomepageBanners(bannerIds),
    onSuccess: async () => {
      await invalidateSettingsQueries()
      setBannerFeedback({
        kind: 'success',
        message: 'Đã cập nhật thứ tự banner trang chủ.',
      })
    },
    onError: (error) => {
      setBannerFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể sắp xếp lại banner'),
      })
    },
  })

  const deleteHomepageBannerMutation = useMutation({
    mutationFn: (bannerId: string) => adminApi.deleteHomepageBanner(bannerId),
    onSuccess: async () => {
      await invalidateSettingsQueries()
      setBannerFeedback({
        kind: 'success',
        message: 'Đã xoá banner trang chủ.',
      })
    },
    onError: (error) => {
      setBannerFeedback({
        kind: 'error',
        message: translateApiError(error, 'Không thể xoá banner'),
      })
    },
  })

  const updateTelegramRuntimeConfigMutation = useMutation({
    mutationFn: (input: UpdateTelegramRuntimeConfigInput) =>
      adminApi.updateTelegramRuntimeConfig(input),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.adminTelegramRuntimeConfig,
      })
      setTelegramRuntimeChatIdInput(result.chatId)
      setTelegramRuntimeTokenInput('')
      setTelegramRuntimeFeedback({
        kind: 'success',
        message:
          'Đã cập nhật Telegram bot runtime. Bot sẽ tự áp dụng cấu hình mới.',
      })
    },
    onError: (error) => {
      setTelegramRuntimeFeedback({
        kind: 'error',
        message: translateApiError(
          error,
          'Không thể cập nhật Telegram bot runtime',
        ),
      })
    },
  })

  const logout = async () => {
    try {
      if (session?.refreshToken) {
        await authApi.logout(session.refreshToken)
      }
    } catch {}

    setIsMobileSidebarOpen(false)
    clearSession()
    queryClient.clear()
    await navigate({ to: '/' })
  }

  const bankAccounts = sortByPriority(adminBankAccountsQuery.data ?? [])
  const bankOptions = bankOptionsQuery.data ?? []
  const deposits = sortNewest(adminDepositsQuery.data ?? [])
  const withdrawals = sortNewest(adminWithdrawalsQuery.data ?? [])
  const exchangeOrders = sortNewest(adminExchangeOrdersQuery.data ?? [])
  const overviewMetrics = useMemo(
    () =>
      buildAdminOverviewMetrics({
        bankAccounts,
        deposits:
          overviewDepositsQuery.data ?? (statusFilter === 'all' ? deposits : []),
        exchangeOrders,
        statusFilter,
        users: adminUsersOverviewQuery.data ?? [],
        withdrawals:
          overviewWithdrawalsQuery.data ??
          (statusFilter === 'all' ? withdrawals : []),
      }),
    [
      adminUsersOverviewQuery.data,
      bankAccounts,
      deposits,
      exchangeOrders,
      overviewDepositsQuery.data,
      overviewWithdrawalsQuery.data,
      statusFilter,
      withdrawals,
    ],
  )
  const depositReviewUiCopy = getDepositReviewUiCopy()
  const withdrawalReviewUiCopy = getWithdrawalReviewUiCopy()
  const homepageBanners = adminSettingsQuery.data?.homepageBanners ?? []

  function updateFromDate(value: string) {
    setDateRange((current) => ({
      ...current,
      fromDate: value,
    }))
  }

  function updateToDate(value: string) {
    setDateRange((current) => ({
      ...current,
      toDate: value,
    }))
  }

  function renderDateRangeFilter(idPrefix: string) {
    return (
      <AdminDateFilter
        errorMessage={dateRangeError || undefined}
        fromDate={dateRange.fromDate}
        fromId={`${idPrefix}-from`}
        onFromDateChange={updateFromDate}
        onToDateChange={updateToDate}
        toDate={dateRange.toDate}
        toId={`${idPrefix}-to`}
      />
    )
  }

  const nextPriority = useMemo(() => {
    return getNextBankPriority(bankAccounts)
  }, [bankAccounts])

  useEffect(() => {
    if (adminSettingsQuery.data?.depositReservationTtlMinutes) {
      setReservationTtlInput(String(adminSettingsQuery.data.depositReservationTtlMinutes))
      setExchangeUsdtToVndFeeBpsInput(
        formatFeePercentInputFromBps(adminSettingsQuery.data.exchangeUsdtToVndFeeBps),
      )
      setExchangeUsdtToVndMarkupVndInput(
        String(adminSettingsQuery.data.exchangeUsdtToVndMarkupVnd),
      )
      setExchangeVndToUsdtFeeBpsInput(
        formatFeePercentInputFromBps(adminSettingsQuery.data.exchangeVndToUsdtFeeBps),
      )
      setExchangeMarkupVndInput(String(adminSettingsQuery.data.exchangeVndToUsdtMarkupVnd))
      setSupportLinkInput(adminSettingsQuery.data.supportLink)
      setWithdrawalVndFeeBpsInput(
        formatFeePercentInputFromBps(adminSettingsQuery.data.withdrawalVndFeeBps),
      )
      setWithdrawalUsdtFeeBpsInput(
        formatFeePercentInputFromBps(adminSettingsQuery.data.withdrawalUsdtFeeBps),
      )
    }
  }, [
    adminSettingsQuery.data?.depositReservationTtlMinutes,
    adminSettingsQuery.data?.exchangeUsdtToVndFeeBps,
    adminSettingsQuery.data?.exchangeUsdtToVndMarkupVnd,
    adminSettingsQuery.data?.exchangeVndToUsdtFeeBps,
    adminSettingsQuery.data?.exchangeVndToUsdtMarkupVnd,
    adminSettingsQuery.data?.supportLink,
    adminSettingsQuery.data?.withdrawalUsdtFeeBps,
    adminSettingsQuery.data?.withdrawalVndFeeBps,
  ])

  useEffect(() => {
    if (!telegramRuntimeConfigQuery.data) {
      return
    }

    setTelegramRuntimeChatIdInput(telegramRuntimeConfigQuery.data.chatId)
    setTelegramRuntimeTokenInput('')
  }, [telegramRuntimeConfigQuery.data?.chatId])

  if (profileQuery.isPending) {
    return <ScreenLoader />
  }

  const adminEmail = profileQuery.data?.email ?? session?.user.email ?? 'admin'

  const openEditBankForm = (bank: AdminBankAccount) => {
    setBankEditingId(bank.id)
    setBankFeedback(null)
    setBankForm(toBankFormValues(bank))
  }

  const closeBankForm = () => {
    setBankEditingId(null)
    setBankForm(createEmptyBankForm(nextPriority))
  }

  const submitBankForm = async () => {
    const selectedBank = findVietQrBank(bankOptions, bankForm.bankCode)
    const bankName = selectedBank?.shortName ?? bankForm.bankName

    if (
      !bankForm.bankCode.trim() ||
      !bankName.trim() ||
      !bankForm.accountNumber.trim() ||
      !bankForm.accountName.trim() ||
      !bankForm.dailyLimit.trim() ||
      !bankForm.priority.trim()
    ) {
      setBankFeedback({
        kind: 'error',
        message: 'Vui lòng chọn ngân hàng và nhập đủ thông tin cấu hình.',
      })
      return
    }

    const payload: UpdateBankAccountInput = {
      accountName: bankForm.accountName.trim(),
      accountNumber: bankForm.accountNumber.trim(),
      bankCode: bankForm.bankCode.trim(),
      bankName: bankName.trim(),
      dailyLimit: bankForm.dailyLimit.trim(),
      isActive: bankForm.isActive,
      priority: Number(bankForm.priority),
    }

    if (!Number.isInteger(payload.priority) || payload.priority <= 0) {
      setBankFeedback({
        kind: 'error',
        message: 'Ưu tiên phải là số nguyên dương.',
      })
      return
    }

    if (bankEditingId) {
      await updateBankAccountMutation.mutateAsync({
        id: bankEditingId,
        input: payload,
      })
    } else {
      await createBankAccountMutation.mutateAsync(payload)
    }

    closeBankForm()
  }

  const toggleBankActive = async (bank: AdminBankAccount) => {
    await updateBankAccountMutation.mutateAsync({
      id: bank.id,
      input: {
        accountName: bank.accountName,
        accountNumber: bank.accountNumber,
        bankCode: bank.bankCode,
        bankName: bank.bankName,
        dailyLimit: bank.dailyLimit,
        isActive: !bank.isActive,
        priority: bank.priority,
      },
    })
  }

  const submitSettingsForm = async () => {
    const ttl = Number.parseInt(reservationTtlInput.trim(), 10)
    const exchangeUsdtToVndFeeBps = parseFeePercentInputToBps(
      exchangeUsdtToVndFeeBpsInput,
    )
    const exchangeUsdtToVndMarkupVnd = Number.parseInt(
      exchangeUsdtToVndMarkupVndInput.trim(),
      10,
    )
    const exchangeVndToUsdtFeeBps = parseFeePercentInputToBps(
      exchangeVndToUsdtFeeBpsInput,
    )
    const exchangeMarkupVnd = Number.parseInt(exchangeMarkupVndInput.trim(), 10)
    const supportLink = supportLinkInput.trim()
    const withdrawalVndFeeBps = parseFeePercentInputToBps(
      withdrawalVndFeeBpsInput,
    )
    const withdrawalUsdtFeeBps = parseFeePercentInputToBps(
      withdrawalUsdtFeeBpsInput,
    )

    if (!Number.isInteger(ttl) || ttl <= 0) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Thời gian giữ chỗ phải là số nguyên dương.',
      })
      return
    }

    const isInvalidFee = (value: number | null) => value === null

    if (
      !Number.isInteger(exchangeMarkupVnd) ||
      exchangeMarkupVnd < 0 ||
      !Number.isInteger(exchangeUsdtToVndMarkupVnd) ||
      exchangeUsdtToVndMarkupVnd < 0
    ) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Markup tỷ giá phải là số nguyên VND không âm.',
      })
      return
    }

    if (
      isInvalidFee(exchangeUsdtToVndFeeBps) ||
      isInvalidFee(exchangeVndToUsdtFeeBps) ||
      isInvalidFee(withdrawalVndFeeBps) ||
      isInvalidFee(withdrawalUsdtFeeBps)
    ) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Các mức phí phải là số từ 0 đến 100%, tối đa 2 số lẻ.',
      })
      return
    }

    if (!supportLink) {
      setSettingsFeedback({
        kind: 'error',
        message: 'Link hỗ trợ không được để trống.',
      })
      return
    }

    await updateSettingsMutation.mutateAsync({
      depositReservationTtlMinutes: ttl,
      exchangeUsdtToVndFeeBps,
      exchangeUsdtToVndMarkupVnd,
      exchangeVndToUsdtFeeBps,
      exchangeVndToUsdtMarkupVnd: exchangeMarkupVnd,
      supportLink,
      withdrawalUsdtFeeBps,
      withdrawalVndFeeBps,
    })
  }

  const uploadHomepageBanner = async (file: File) => {
    const formData = new FormData()
    formData.set('image', file)
    await uploadHomepageBannerMutation.mutateAsync(formData)
  }

  const reorderHomepageBanners = async (bannerIds: string[]) => {
    const currentBannerIds = homepageBanners.map((banner) => banner.id)

    if (
      currentBannerIds.length === bannerIds.length &&
      currentBannerIds.every((bannerId, index) => bannerId === bannerIds[index])
    ) {
      return
    }

    await reorderHomepageBannersMutation.mutateAsync(bannerIds)
  }

  const deleteHomepageBanner = async (bannerId: string) => {
    if (!window.confirm('Xoá banner này khỏi trang chủ?')) {
      return
    }

    await deleteHomepageBannerMutation.mutateAsync(bannerId)
  }

  const submitTelegramRuntimeConfig = async () => {
    const chatId = telegramRuntimeChatIdInput.trim()
    const token = telegramRuntimeTokenInput.trim()

    if (!chatId) {
      setTelegramRuntimeFeedback({
        kind: 'error',
        message: 'Chat ID Telegram không được để trống.',
      })
      return
    }

    await updateTelegramRuntimeConfigMutation.mutateAsync({
      chatId,
      ...(token ? { token } : {}),
    })
  }

  const renderFilterButtons = () => (
    <div className={styles.filterBar}>
      {adminStatusFilterOrder.map(
        (status) => (
          <button
            key={status}
            type="button"
            className={`${styles.filterBtn} ${statusFilter === status ? styles.filterActive : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {adminStatusLabels[status]}
          </button>
        ),
      )}
    </div>
  )

  const renderTransactionSearchBox = (
    value: string,
    onChange: (nextValue: string) => void,
    placeholder = 'Tìm theo email, user ID, số điện thoại...',
  ) => (
    <div className={styles.searchBox}>
      <i className="fas fa-search" />
      <input
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  )

  return (
    <div className={styles.adminWrap}>
      <aside
        className={`${styles.sidebar} ${isMobileSidebarOpen ? styles.sidebarMobileOpen : ''}`.trim()}
      >
        <div className={styles.sidebarLogo}>
          <i className="fas fa-shield-alt" />
          <span>ADMIN</span>
        </div>
        <nav className={styles.sideNav}>
          {visibleAdminTabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.navBtn} ${activeTab === tab.id ? styles.navActive : ''}`}
              type="button"
              onClick={() => handleSelectTab(tab.id)}
            >
              <i className={tab.icon} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <button className={styles.logoutBtn} onClick={() => void logout()} type="button">
          <i className="fas fa-sign-out-alt" />
          <span>Đăng xuất</span>
        </button>
      </aside>

      <main className={styles.mainArea}>
        <header className={styles.topBar}>
          <div className={styles.topBarLead}>
            <button
              aria-expanded={isMobileSidebarOpen}
              aria-label={isMobileSidebarOpen ? 'Đóng menu quản trị' : 'Mở menu quản trị'}
              className={styles.mobileMenuBtn}
              type="button"
              onClick={() => setIsMobileSidebarOpen((current) => !current)}
            >
              <i className={`fas ${isMobileSidebarOpen ? 'fa-times' : 'fa-bars'}`} />
            </button>
            <div className={styles.topBarTitle}>
              {visibleAdminTabs.find((tab) => tab.id === activeTab)?.label}
            </div>
          </div>
          <div className={styles.adminBadge}>
            <i className="fas fa-user-shield" />
            {adminEmail}
          </div>
        </header>

        <div className={styles.content}>
          {reviewFeedback ? (
            <FeedbackBanner
              kind={reviewFeedback.kind}
              message={reviewFeedback.message}
            />
          ) : null}

          {activeTab === 'overview' ? (
            <OverviewSection
              isPending={
                overviewDepositsQuery.isPending ||
                overviewWithdrawalsQuery.isPending ||
                adminExchangeOrdersQuery.isPending ||
                adminUsersOverviewQuery.isPending
              }
              fromDate={queryFromDate}
              metrics={overviewMetrics}
              statusFilter={statusFilter}
              toDate={queryToDate}
              toolbar={
                <div className={styles.toolbarGroup}>
                  {renderFilterButtons()}
                  {shouldShowAdminDateFilter(activeTab)
                    ? renderDateRangeFilter('admin-overview-date-filter')
                    : null}
                </div>
              }
            />
          ) : null}

          {activeTab === 'transactions' ? (
            <ReviewSection
              emptyMessage={depositReviewUiCopy.emptyMessage}
              dateFilter={renderDateRangeFilter('admin-deposits-date-filter')}
              filterBar={renderFilterButtons()}
              isPending={adminDepositsQuery.isPending}
              isRefreshing={adminDepositsQuery.isRefetching}
              items={deposits}
              loadingMessage={depositReviewUiCopy.loadingMessage}
              noteMap={depositNotes}
              onApprove={(id) =>
                approveDepositMutation.mutateAsync({
                  id,
                  note: depositNotes[id]?.trim() || undefined,
                })
              }
              onNoteChange={(id, value) =>
                setDepositNotes((current) => ({
                  ...current,
                  [id]: value,
                }))
              }
              onReject={(id) =>
                rejectDepositMutation.mutateAsync({
                  id,
                  note: depositNotes[id]?.trim() || undefined,
                })
              }
              pendingLabel={depositReviewUiCopy.pendingLabel}
              onRefresh={() => {
                void adminDepositsQuery.refetch()
              }}
              onRestorePending={(id) =>
                restoreDepositPendingMutation.mutateAsync(id)
              }
              searchBox={renderTransactionSearchBox(
                depositSearch,
                setDepositSearch,
              )}
              renderDetails={(item) => (
                <>
                  <InfoRow label="Số tiền" value={moneyLabel(item.amount, item.assetCode)} />
                  <InfoRow label="Phương thức" value={item.method} />
                  <InfoRow
                    label="Tài khoản nhận tiền"
                    value={
                      item.selectedBankAccount
                        ? `${item.selectedBankAccount.bankName} - ${item.selectedBankAccount.accountNumber}`
                        : 'Không áp dụng'
                    }
                  />
                  <InfoRow
                    label="Tên người thụ hưởng"
                    value={item.selectedBankAccount?.accountName ?? 'Không áp dụng'}
                  />
                  <InfoRow
                    label="Nội dung chuyển khoản"
                    value={item.destinationRef ?? 'Không có'}
                  />
                </>
              )}
              statusFilter={statusFilter}
              submittingApprove={approveDepositMutation.isPending}
              submittingReject={rejectDepositMutation.isPending}
              submittingRestore={restoreDepositPendingMutation.isPending}
            />
          ) : null}

          {activeTab === 'withdrawals' ? (
            <ReviewSection
              emptyMessage={withdrawalReviewUiCopy.emptyMessage}
              dateFilter={renderDateRangeFilter('admin-withdrawals-date-filter')}
              filterBar={renderFilterButtons()}
              isPending={adminWithdrawalsQuery.isPending}
              isRefreshing={adminWithdrawalsQuery.isRefetching}
              items={withdrawals}
              loadingMessage={withdrawalReviewUiCopy.loadingMessage}
              noteMap={withdrawalNotes}
              onApprove={(id) =>
                approveWithdrawalMutation.mutateAsync({
                  id,
                  note: withdrawalNotes[id]?.trim() || undefined,
                })
              }
              onNoteChange={(id, value) =>
                setWithdrawalNotes((current) => ({
                  ...current,
                  [id]: value,
                }))
              }
              onReject={(id) =>
                rejectWithdrawalMutation.mutateAsync({
                  id,
                  note: withdrawalNotes[id]?.trim() || undefined,
                })
              }
              onRefresh={() => {
                void adminWithdrawalsQuery.refetch()
              }}
              onRestorePending={(id) =>
                restoreWithdrawalPendingMutation.mutateAsync(id)
              }
              pendingLabel={withdrawalReviewUiCopy.pendingLabel}
              searchBox={renderTransactionSearchBox(
                withdrawalSearch,
                setWithdrawalSearch,
              )}
              renderDetails={(item) => (
                <>
                  <InfoRow label="Số tiền" value={moneyLabel(item.amount, item.assetCode)} />
                  <InfoRow
                    label="Phí giao dịch"
                    value={moneyLabel(item.feeAmount ?? '0', item.assetCode)}
                  />
                  <InfoRow
                    label="Tổng tiền bị trừ khỏi ví"
                    value={moneyLabel(item.totalDebit ?? item.amount, item.assetCode)}
                  />
                  <InfoRow label="Phương thức" value={item.method} />
                  <InfoRow
                    label="Thông tin nhận tiền"
                    value={describeDestinationDetails(item.destinationDetails)}
                  />
                  <AdminWithdrawalQrCard
                    amount={item.amount}
                    bankOptions={bankOptions}
                    destinationDetails={item.destinationDetails}
                  />
                </>
              )}
              statusFilter={statusFilter}
              submittingApprove={approveWithdrawalMutation.isPending}
              submittingReject={rejectWithdrawalMutation.isPending}
              submittingRestore={restoreWithdrawalPendingMutation.isPending}
            />
          ) : null}

          {activeTab === 'exchange' ? (
            <ExchangeSection
              dateFilter={renderDateRangeFilter('admin-exchange-date-filter')}
              exchangeOrders={exchangeOrders}
              isPending={adminExchangeOrdersQuery.isPending}
              isRefreshing={adminExchangeOrdersQuery.isRefetching}
              onRefresh={() => {
                void adminExchangeOrdersQuery.refetch()
              }}
              onReverse={(id) => reverseExchangeOrderMutation.mutateAsync(id)}
              searchBox={renderTransactionSearchBox(
                exchangeSearch,
                setExchangeSearch,
              )}
              submittingReverse={reverseExchangeOrderMutation.isPending}
            />
          ) : null}

          {activeTab === 'banks' ? (
            <BankAccountsSection
              bankAccounts={bankAccounts}
              bankFeedback={bankFeedback}
              bankForm={bankForm}
              bankOptions={bankOptions}
              bankOptionsPending={bankOptionsQuery.isPending}
              editingBankId={bankEditingId}
              isDeleting={deleteBankAccountMutation.isPending}
              isPending={adminBankAccountsQuery.isPending}
              isRefreshing={adminBankAccountsQuery.isRefetching}
              isResetting={resetBankUsageMutation.isPending}
              isSubmitting={
                createBankAccountMutation.isPending || updateBankAccountMutation.isPending
              }
              onDelete={async (id) => {
                if (!window.confirm('Xoá tài khoản ngân hàng này?')) {
                  return
                }
                await deleteBankAccountMutation.mutateAsync(id)
                if (bankEditingId === id) {
                  closeBankForm()
                }
              }}
              onFormChange={(patch) =>
                setBankForm((current) => ({
                  ...current,
                  ...patch,
                }))
              }
              onOpenEdit={openEditBankForm}
              onRefresh={() => {
                void adminBankAccountsQuery.refetch()
              }}
              onResetUsage={async () => {
                if (!window.confirm('Reset mức dùng hôm nay cho toàn bộ tài khoản?')) {
                  return
                }
                await resetBankUsageMutation.mutateAsync()
              }}
              onSubmit={() => void submitBankForm()}
              onToggleActive={(bank) => void toggleBankActive(bank)}
              onCancelForm={closeBankForm}
            />
          ) : null}

          {activeTab === 'users' ? (
            <UsersSection
              canManageUserAccounts={
                session?.user.roles.includes('super_admin') ?? false
              }
            />
          ) : null}

          {activeTab === 'settings' ? (
            <SettingsSection
              bannerFeedback={bannerFeedback}
              canManageTelegramRuntimeConfig={canManageTelegramRuntimeConfig}
              exchangeUsdtToVndFeeBpsInput={exchangeUsdtToVndFeeBpsInput}
              exchangeUsdtToVndMarkupVndInput={exchangeUsdtToVndMarkupVndInput}
              exchangeVndToUsdtFeeBpsInput={exchangeVndToUsdtFeeBpsInput}
              feedback={settingsFeedback}
              exchangeMarkupVndInput={exchangeMarkupVndInput}
              homepageBanners={homepageBanners}
              isDeletingBanner={deleteHomepageBannerMutation.isPending}
              isPending={adminSettingsQuery.isPending}
              isReorderingBanners={reorderHomepageBannersMutation.isPending}
              isSubmitting={updateSettingsMutation.isPending}
              isUploadingBanner={uploadHomepageBannerMutation.isPending}
              reservationTtlInput={reservationTtlInput}
              onChange={(patch) => {
                if (patch.reservationTtlInput !== undefined) {
                  setReservationTtlInput(patch.reservationTtlInput)
                }
                if (patch.exchangeMarkupVndInput !== undefined) {
                  setExchangeMarkupVndInput(patch.exchangeMarkupVndInput)
                }
                if (patch.exchangeUsdtToVndFeeBpsInput !== undefined) {
                  setExchangeUsdtToVndFeeBpsInput(patch.exchangeUsdtToVndFeeBpsInput)
                }
                if (patch.exchangeUsdtToVndMarkupVndInput !== undefined) {
                  setExchangeUsdtToVndMarkupVndInput(
                    patch.exchangeUsdtToVndMarkupVndInput,
                  )
                }
                if (patch.exchangeVndToUsdtFeeBpsInput !== undefined) {
                  setExchangeVndToUsdtFeeBpsInput(patch.exchangeVndToUsdtFeeBpsInput)
                }
                if (patch.supportLinkInput !== undefined) {
                  setSupportLinkInput(patch.supportLinkInput)
                }
                if (patch.telegramRuntimeChatIdInput !== undefined) {
                  setTelegramRuntimeChatIdInput(patch.telegramRuntimeChatIdInput)
                }
                if (patch.telegramRuntimeTokenInput !== undefined) {
                  setTelegramRuntimeTokenInput(patch.telegramRuntimeTokenInput)
                }
                if (patch.withdrawalUsdtFeeBpsInput !== undefined) {
                  setWithdrawalUsdtFeeBpsInput(patch.withdrawalUsdtFeeBpsInput)
                }
                if (patch.withdrawalVndFeeBpsInput !== undefined) {
                  setWithdrawalVndFeeBpsInput(patch.withdrawalVndFeeBpsInput)
                }
                setSettingsFeedback(null)
              }}
              onDeleteBanner={(bannerId) => void deleteHomepageBanner(bannerId)}
              onReorderBanners={(bannerIds) => void reorderHomepageBanners(bannerIds)}
              onSubmit={() => void submitSettingsForm()}
              onTelegramRuntimeConfigChange={(patch) => {
                if (patch.telegramRuntimeChatIdInput !== undefined) {
                  setTelegramRuntimeChatIdInput(patch.telegramRuntimeChatIdInput)
                }
                if (patch.telegramRuntimeTokenInput !== undefined) {
                  setTelegramRuntimeTokenInput(patch.telegramRuntimeTokenInput)
                }
                setTelegramRuntimeFeedback(null)
              }}
              onTelegramRuntimeConfigSubmit={() => void submitTelegramRuntimeConfig()}
              onUploadBanner={(file) => void uploadHomepageBanner(file)}
              supportLinkInput={supportLinkInput}
              telegramRuntimeBotUsername={
                telegramRuntimeConfigQuery.data?.botUsername ?? null
              }
              telegramRuntimeChatIdInput={telegramRuntimeChatIdInput}
              telegramRuntimeFeedback={telegramRuntimeFeedback}
              telegramRuntimeIsConfigured={
                telegramRuntimeConfigQuery.data?.configured ?? false
              }
              telegramRuntimeIsPending={
                telegramRuntimeConfigQuery.isPending ||
                updateTelegramRuntimeConfigMutation.isPending
              }
              telegramRuntimeLastValidatedAt={
                telegramRuntimeConfigQuery.data?.lastValidatedAt ?? null
              }
              telegramRuntimeTokenInput={telegramRuntimeTokenInput}
              telegramRuntimeTokenSuffix={
                telegramRuntimeConfigQuery.data?.tokenSuffix ?? null
              }
              telegramRuntimeUpdatedAt={
                telegramRuntimeConfigQuery.data?.updatedAt ?? null
              }
              telegramRuntimeVersion={
                telegramRuntimeConfigQuery.data?.version ?? null
              }
              withdrawalUsdtFeeBpsInput={withdrawalUsdtFeeBpsInput}
              withdrawalVndFeeBpsInput={withdrawalVndFeeBpsInput}
            />
          ) : null}
        </div>
      </main>
    </div>
  )
}

function formatOverviewMoney(amount: number, assetCode: 'VND' | 'USDT') {
  return assetCode === 'VND' ? `${formatVnd(amount)} đ` : `${formatUsdt(amount)} USDT`
}

function getOverviewAssetTotals(
  metrics: ReturnType<typeof buildAdminOverviewMetrics>,
) {
  return {
    filteredDepositCount:
      metrics.filtered.vnd.depositCount + metrics.filtered.usdt.depositCount,
    filteredTransactionCount:
      metrics.filtered.vnd.transactionCount +
      metrics.filtered.usdt.transactionCount +
      metrics.transactions.exchangeCount,
    filteredWithdrawalCount:
      metrics.filtered.vnd.withdrawalCount + metrics.filtered.usdt.withdrawalCount,
    exchangeCount: metrics.transactions.exchangeCount,
    pendingDepositCount: metrics.pending.vnd.depositCount + metrics.pending.usdt.depositCount,
    pendingTransactionCount:
      metrics.pending.vnd.transactionCount + metrics.pending.usdt.transactionCount,
    pendingWithdrawalCount:
      metrics.pending.vnd.withdrawalCount + metrics.pending.usdt.withdrawalCount,
  }
}

export function OverviewSection({
  fromDate,
  isPending = false,
  metrics,
  statusFilter,
  toDate,
  toolbar,
}: {
  fromDate: string
  isPending?: boolean
  metrics: ReturnType<typeof buildAdminOverviewMetrics>
  statusFilter: AdminStatusFilter
  toDate: string
  toolbar?: ReactNode
}) {
  const totals = getOverviewAssetTotals(metrics)
  const dateRangeLabel =
    fromDate && toDate
      ? fromDate === toDate
        ? fromDate
        : `từ ${fromDate} đến ${toDate}`
      : 'khoảng hiện tại'
  const filterContext = `${adminStatusLabels[statusFilter]} · ${dateRangeLabel}`
  const profitContext =
    fromDate && toDate
      ? `Lợi nhuận luôn tính theo ${
          fromDate === toDate ? `ngày ${fromDate}` : `khoảng ${dateRangeLabel}`
        }, không áp dụng bộ lọc trạng thái.`
      : 'Lợi nhuận luôn tính theo khoảng hiện tại, không áp dụng bộ lọc trạng thái.'

  return (
    <section className={styles.sectionCard}>
      {toolbar ? <div className={styles.overviewToolbar}>{toolbar}</div> : null}
      <div className={styles.overviewMeta}>
        <p className={styles.sectionSub}>Bộ lọc hiện tại: <strong>{filterContext}</strong></p>
        <p className={styles.sectionSub}>{profitContext}</p>
      </div>

      {isPending ? (
        <ScreenLoader message="Đang tải số liệu tổng quan..." />
      ) : (
        <>
          <div className={styles.overviewHero}>
            <div className={`${styles.overviewHeroCard} ${styles.overviewHeroPrimary}`}>
              <div className={styles.overviewHeroEyebrow}>Tổng giao dịch</div>
              <div className={styles.overviewHeroTitle}>
                {totals.filteredTransactionCount} giao dịch trong bộ lọc hiện tại
              </div>
              <div className={styles.overviewHeroSub}>
                Theo dõi nhanh số lệnh theo bộ lọc hiện tại và lợi nhuận thực nhận theo ngày.
              </div>
              <div className={styles.overviewHeroMetrics}>
                <div className={styles.overviewHeroMetric}>
                  <span className={styles.overviewHeroMetricLabel}>Số lệnh nạp</span>
                  <span className={styles.overviewHeroMetricValue}>
                    {totals.filteredDepositCount}
                  </span>
                  <span className={styles.overviewHeroMetricMeta}>
                    {adminStatusLabels[statusFilter]}
                  </span>
                </div>
                <div className={styles.overviewHeroMetric}>
                  <span className={styles.overviewHeroMetricLabel}>Số lệnh rút</span>
                  <span className={styles.overviewHeroMetricValue}>
                    {totals.filteredWithdrawalCount}
                  </span>
                  <span className={styles.overviewHeroMetricMeta}>
                    {adminStatusLabels[statusFilter]}
                  </span>
                </div>
                <div className={styles.overviewHeroMetric}>
                  <span className={styles.overviewHeroMetricLabel}>Lệnh đổi tiền</span>
                  <span className={styles.overviewHeroMetricValue}>
                    {totals.exchangeCount}
                  </span>
                  <span className={styles.overviewHeroMetricMeta}>
                    {statusFilter === 'all' || statusFilter === 'approved'
                      ? 'Hoàn tất trong ngày'
                      : 'Không khớp trạng thái'}
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.overviewHeroColumn}>
              <div className={`${styles.overviewHeroCard} ${styles.overviewHeroSecondary}`}>
                <div className={styles.overviewHeroEyebrow}>Pending review</div>
                <div className={styles.overviewQuickList}>
                  <div className={styles.overviewQuickRow}>
                    <span>Tổng yêu cầu chờ duyệt</span>
                    <b>{totals.pendingTransactionCount}</b>
                  </div>
                  <div className={styles.overviewQuickRow}>
                    <span>Nạp chờ duyệt</span>
                    <b>{totals.pendingDepositCount}</b>
                  </div>
                  <div className={styles.overviewQuickRow}>
                    <span>Rút chờ duyệt</span>
                    <b>{totals.pendingWithdrawalCount}</b>
                  </div>
                  <div className={styles.overviewQuickRow}>
                    <span>Tổng lợi nhuận</span>
                    <b>{formatOverviewMoney(metrics.profit.totalVnd, 'VND')}</b>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.overviewGroup}>
            <div className={styles.overviewGroupHeader}>
              <div className={styles.overviewGroupTitle}>Khối lượng giao dịch</div>
              <div className={styles.overviewGroupSub}>
                Tập trung vào số lượng lệnh và queue cần xử lý.
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-layer-group"
                label="Tổng giao dịch trong bộ lọc"
                value={String(totals.filteredTransactionCount)}
              />
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-arrow-down"
                label="Số lệnh nạp"
                value={String(totals.filteredDepositCount)}
              />
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-arrow-up"
                label="Số lệnh rút"
                value={String(totals.filteredWithdrawalCount)}
              />
              <StatCard
                className={styles.statCardUrgent}
                icon="fas fa-hourglass-half"
                label="Pending review"
                value={String(totals.pendingTransactionCount)}
              />
            </div>
          </div>

          <div className={styles.overviewGroup}>
            <div className={styles.overviewGroupHeader}>
              <div className={styles.overviewGroupTitle}>Lợi nhuận</div>
              <div className={styles.overviewGroupSub}>
                Chỉ ghi nhận khi rút đã duyệt và lệnh đổi tiền đã hoàn tất. Không áp dụng bộ lọc trạng thái.
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-sack-dollar"
                label="Tổng lợi nhuận thực nhận"
                value={formatOverviewMoney(metrics.profit.totalVnd, 'VND')}
              />
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-percent"
                label="Lợi nhuận từ % giao dịch"
                value={formatOverviewMoney(metrics.profit.feeVnd, 'VND')}
                meta={`Gốc: ${formatOverviewMoney(metrics.profit.feeNative.vnd, 'VND')} · ${formatOverviewMoney(metrics.profit.feeNative.usdt, 'USDT')}`}
              />
              <StatCard
                className={styles.statCardWarm}
                icon="fas fa-arrows-left-right-to-line"
                label="Lợi nhuận từ markup exchange"
                value={formatOverviewMoney(metrics.profit.markupVnd, 'VND')}
                meta="Lợi nhuận từ chênh lệch markup với realtime"
              />
            </div>
          </div>

          <div className={styles.overviewGroup}>
            <div className={styles.overviewGroupHeader}>
              <div className={styles.overviewGroupTitle}>Dòng tiền VND</div>
              <div className={styles.overviewGroupSub}>
                Giá trị nạp, rút và chênh lệch thuần của VND.
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-wallet"
                label="Tổng nạp VND"
                value={formatOverviewMoney(metrics.filtered.vnd.depositAmountTotal, 'VND')}
              />
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-hand-holding-usd"
                label="Tổng rút VND"
                value={formatOverviewMoney(metrics.filtered.vnd.withdrawalAmountTotal, 'VND')}
              />
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-scale-balanced"
                label="Chênh lệch thuần VND"
                value={formatOverviewMoney(metrics.filtered.vnd.netAmount, 'VND')}
              />
              <StatCard
                className={styles.statCardUrgent}
                icon="fas fa-hourglass-half"
                label="Pending VND"
                value={formatOverviewMoney(metrics.pending.vnd.netAmount, 'VND')}
              />
            </div>
          </div>

          <div className={styles.overviewGroup}>
            <div className={styles.overviewGroupHeader}>
              <div className={styles.overviewGroupTitle}>Dòng tiền USDT</div>
              <div className={styles.overviewGroupSub}>
                Giá trị nạp, rút và chênh lệch thuần của USDT.
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-coins"
                label="Tổng nạp USDT"
                value={formatOverviewMoney(metrics.filtered.usdt.depositAmountTotal, 'USDT')}
              />
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-paper-plane"
                label="Tổng rút USDT"
                value={formatOverviewMoney(metrics.filtered.usdt.withdrawalAmountTotal, 'USDT')}
              />
              <StatCard
                className={styles.statCardCool}
                icon="fas fa-scale-balanced"
                label="Chênh lệch thuần USDT"
                value={formatOverviewMoney(metrics.filtered.usdt.netAmount, 'USDT')}
              />
              <StatCard
                className={styles.statCardUrgent}
                icon="fas fa-hourglass-half"
                label="Pending USDT"
                value={formatOverviewMoney(metrics.pending.usdt.netAmount, 'USDT')}
              />
            </div>
          </div>

          <div className={`${styles.overviewGroup} ${styles.overviewGroupCompact}`}>
            <div className={styles.overviewGroupHeader}>
              <div className={styles.overviewGroupTitle}>Vận hành hệ thống</div>
              <div className={styles.overviewGroupSub}>
                Khối phụ gọn cho ngân hàng và tài khoản quản trị.
              </div>
            </div>
            <div className={styles.statsGrid}>
              <StatCard
                className={styles.statCardNeutral}
                icon="fas fa-play-circle"
                label="Tài khoản ngân hàng active"
                value={String(metrics.banks.activeCount)}
              />
              <StatCard
                className={styles.statCardNeutral}
                icon="fas fa-pause-circle"
                label="Tài khoản ngân hàng tạm dừng"
                value={String(metrics.banks.pausedCount)}
              />
              <StatCard
                className={styles.statCardNeutral}
                icon="fas fa-users"
                label="Tổng tài khoản"
                value={String(metrics.users.totalCount)}
              />
              <StatCard
                className={styles.statCardNeutral}
                icon="fas fa-user-shield"
                label="Tài khoản admin"
                value={String(metrics.users.adminCount)}
              />
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export function BankAccountsSection({
  bankAccounts,
  bankFeedback,
  bankForm,
  bankOptions,
  bankOptionsPending,
  editingBankId,
  isDeleting,
  isPending,
  isRefreshing,
  isResetting,
  isSubmitting,
  onDelete,
  onFormChange,
  onOpenEdit,
  onRefresh,
  onResetUsage,
  onSubmit,
  onToggleActive,
  onCancelForm,
}: {
  bankAccounts: AdminBankAccount[]
  bankFeedback: FeedbackState | null
  bankForm: BankFormValues
  bankOptions: VietQrBankOption[]
  bankOptionsPending: boolean
  editingBankId: string | null
  isDeleting: boolean
  isPending: boolean
  isRefreshing: boolean
  isResetting: boolean
  isSubmitting: boolean
  onDelete: (id: string) => Promise<void>
  onFormChange: (patch: Partial<BankFormValues>) => void
  onOpenEdit: (bank: AdminBankAccount) => void
  onRefresh: () => void
  onResetUsage: () => Promise<void>
  onSubmit: () => void
  onToggleActive: (bank: AdminBankAccount) => void
  onCancelForm: () => void
}) {
  const isEditing = Boolean(editingBankId)
  const selectedBank = findVietQrBank(bankOptions, bankForm.bankCode)
  const selectableBankOptions = getBankOptionsForForm(
    bankOptions,
    isEditing
      ? {
          bankCode: bankForm.bankCode,
          bankName: bankForm.bankName,
        }
      : null,
  )

  return (
    <section className={styles.sectionCard}>
      {bankFeedback ? (
        <div
          className={
            bankFeedback.kind === 'success' ? styles.successMsg : styles.errorMsg
          }
        >
          <i
            className={
              bankFeedback.kind === 'success'
                ? 'fas fa-check-circle'
                : 'fas fa-exclamation-circle'
            }
          />
          {bankFeedback.message}
        </div>
      ) : null}

      <div className={`${styles.toolbar} ${styles.bankToolbar}`}>
        <div className={styles.toolbarGroup}>
          <ManualRefreshButton isRefreshing={isRefreshing} onClick={onRefresh} />
          <button
            className={styles.refreshBtn}
            onClick={() => void onResetUsage()}
            type="button"
          >
            <i className="fas fa-undo-alt" />
            {isResetting ? 'Đang reset...' : 'Reset mức dùng'}
          </button>
        </div>
      </div>

      <div className={styles.infoBox}>
        <i className="fas fa-info-circle" />
        <span>
          Hệ thống tự chọn tài khoản theo <b>priority</b> và <b>hạn mức còn lại</b>.
          Hạn mức reset lúc <b>00:00</b> mỗi ngày.
        </span>
      </div>

      <div className={styles.bankFormCard}>
        <div className={styles.sectionHeaderRow}>
          <div>
            <h2 className={styles.sectionTitle}>
              {isEditing ? 'Sửa tài khoản ngân hàng' : 'Thêm tài khoản ngân hàng'}
            </h2>
            <p className={styles.sectionSub}>
              Chọn ngân hàng từ danh sách VietQR rồi nhập hạn mức/ngưỡng fallback.
            </p>
          </div>
        </div>

        <div className={styles.formGrid}>
          <div className={styles.modalField}>
            <label htmlFor="vietqr-bank-select">Ngân hàng VietQR</label>
            <select
              id="vietqr-bank-select"
              value={bankForm.bankCode}
              onChange={(event) => {
                const bank = findVietQrBank(bankOptions, event.target.value)
                onFormChange({
                  bankCode: event.target.value,
                  bankName: bank?.shortName ?? '',
                })
              }}
            >
              <option value="">
                {bankOptionsPending ? 'Đang tải danh sách...' : 'Chọn ngân hàng'}
              </option>
              {selectableBankOptions.map((bank) => (
                <option key={bank.bin} value={bank.bin}>
                  {bank.shortName} ({bank.bin})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.modalField}>
            <label>Số tài khoản</label>
            <input
              type="text"
              placeholder="VD: 123456789"
              value={bankForm.accountNumber}
              onChange={(event) =>
                onFormChange({ accountNumber: event.target.value })
              }
            />
          </div>

          <div className={styles.modalField}>
            <label>Tên chủ tài khoản</label>
            <input
              type="text"
              placeholder="VD: NGAN LUONG"
              value={bankForm.accountName}
              onChange={(event) => onFormChange({ accountName: event.target.value })}
            />
          </div>

          <div className={styles.modalField}>
            <label>Hạn mức ngày (VND)</label>
            <input
              type="number"
              placeholder="VD: 100000000"
              value={bankForm.dailyLimit}
              onChange={(event) => onFormChange({ dailyLimit: event.target.value })}
            />
          </div>

          <div className={styles.modalField}>
            <label>Priority</label>
            <input
              type="number"
              min="1"
              placeholder="1"
              value={bankForm.priority}
              onChange={(event) => onFormChange({ priority: event.target.value })}
            />
          </div>

          <div className={styles.modalField}>
            <label>Hiển thị VietQR</label>
            <input
              type="text"
              readOnly
              value={selectedBank?.name ?? bankForm.bankName}
            />
          </div>
        </div>

        <label className={styles.checkboxRow}>
          <input
            checked={bankForm.isActive}
            type="checkbox"
            onChange={(event) => onFormChange({ isActive: event.target.checked })}
          />
          <span>Kích hoạt tài khoản này cho fallback nạp VND</span>
        </label>

        <div className={styles.modalActions}>
          <button className={styles.cancelBtn} onClick={onCancelForm} type="button">
            {isEditing ? 'Hủy chỉnh sửa' : 'Làm trống'}
          </button>
          <button
            className={styles.saveBtn}
            disabled={isSubmitting}
            onClick={onSubmit}
            type="button"
          >
            {isSubmitting
              ? 'Đang lưu...'
              : isEditing
                ? 'Lưu thay đổi'
                : 'Thêm ngân hàng'}
          </button>
        </div>
      </div>

      {isPending ? (
        <div className={styles.queueEmpty}>Đang tải danh sách ngân hàng...</div>
      ) : bankAccounts.length === 0 ? (
        <div className={styles.queueEmpty}>Chưa có tài khoản ngân hàng nào.</div>
      ) : (
        <div className={styles.bankGrid}>
          {bankAccounts.map((bank) => {
            const consumedToday = getConsumedCapacity(bank)
            const pct = getCapacityPercent(bank)
            const deleteHint = bank.canDelete
              ? 'Xoá tài khoản ngân hàng'
              : bank.pendingDepositCount > 0 && bank.liveReservationCount > 0
                ? 'Tài khoản này đang còn giao dịch nạp chờ duyệt và giữ chỗ đang hoạt động.'
                : bank.pendingDepositCount > 0
                  ? 'Tài khoản này đang còn giao dịch nạp chờ duyệt.'
                  : 'Tài khoản này đang còn giữ chỗ nạp đang hoạt động.'

            return (
              <article
                key={bank.id}
                className={`${styles.bankCard} ${!bank.isActive ? styles.bankInactive : ''}`}
              >
                <div className={styles.bankHeader}>
                  <div className={styles.bankIcon}>
                    <i className="fas fa-university" />
                  </div>
                  <div className={styles.bankMeta}>
                    <div className={styles.bankName}>{bank.bankName}</div>
                    <div className={styles.bankNum}>{bank.accountNumber}</div>
                  </div>
                  <span
                    className={`${styles.activePill} ${bank.isActive ? styles.pillOn : styles.pillOff}`}
                  >
                    {bank.isActive ? 'Hoạt động' : 'Tạm dừng'}
                  </span>
                </div>

                <div className={styles.bankOwner}>
                  <i className="fas fa-user" /> {bank.accountName}
                </div>

                <div className={styles.bankStats}>
                  <InfoRow label="Priority" value={String(bank.priority)} />
                  <InfoRow label="Bank code" value={bank.bankCode} />
                  <InfoRow label="Tổng đã duyệt" value={`${formatVnd(bank.approvedTotal)} đ`} />
                </div>

                <div className={styles.bankLimit}>
                  <span>
                    Đã duyệt hôm nay: <b>{formatVnd(bank.usedToday)} đ</b>
                  </span>
                  <span>
                    Giữ chỗ chưa xác nhận:{' '}
                    <b>{formatVnd(bank.reservedUnconfirmed)} đ</b>
                  </span>
                  <span>
                    Đang chờ admin duyệt:{' '}
                    <b>{formatVnd(bank.reservedPendingReview)} đ</b>
                  </span>
                  <span>
                    Hạn mức hôm nay: <b>{formatVnd(consumedToday)} đ</b> /{' '}
                    {formatVnd(bank.dailyLimit)} đ
                  </span>
                  <span>Còn lại: {formatVnd(bank.remainingToday)} đ</span>
                  <div className={styles.progressBar}>
                    <div
                      className={styles.progressFill}
                      style={{
                        background:
                          pct >= 90 ? '#e74c3c' : pct >= 60 ? '#f39c12' : '#27ae60',
                        width: `${pct}%`,
                      }}
                    />
                  </div>
                </div>

                <div className={styles.bankActions}>
                  <button
                    className={styles.editBtn}
                    onClick={() => onOpenEdit(bank)}
                    type="button"
                  >
                    <i className="fas fa-edit" /> Sửa
                  </button>
                  <button
                    className={bank.isActive ? styles.pauseBtn : styles.resumeBtn}
                    onClick={() => onToggleActive(bank)}
                    type="button"
                  >
                    <i className={`fas ${bank.isActive ? 'fa-pause' : 'fa-play'}`} />
                    {bank.isActive ? 'Tạm dừng' : 'Kích hoạt'}
                  </button>
                  <button
                    className={styles.deleteBtn}
                    disabled={isDeleting || !bank.canDelete}
                    onClick={() => void onDelete(bank.id)}
                    title={deleteHint}
                    type="button"
                  >
                    <i className="fas fa-trash" />
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function ExchangeSection({
  dateFilter,
  exchangeOrders,
  isPending,
  isRefreshing,
  onRefresh,
  onReverse,
  searchBox,
  submittingReverse = false,
}: {
  dateFilter: ReactNode
  exchangeOrders: AdminExchangeOrder[]
  isPending: boolean
  isRefreshing: boolean
  onRefresh: () => void
  onReverse?: (id: string) => Promise<unknown>
  searchBox?: ReactNode
  submittingReverse?: boolean
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>Đổi tiền</h2>
          <p className={styles.sectionSub}>
            Danh sách lệnh đổi tiền hoàn tất, ưu tiên các chỉ số tỷ giá và lợi nhuận.
          </p>
        </div>
        <div className={styles.toolbarGroup}>
          {searchBox}
          {dateFilter}
          <ManualRefreshButton isRefreshing={isRefreshing} onClick={onRefresh} />
        </div>
      </div>

      {isPending ? (
        <ScreenLoader message="Đang tải danh sách đổi tiền..." />
      ) : exchangeOrders.length === 0 ? (
        <div className={styles.queueEmpty}>Chưa có lệnh đổi tiền nào trong bộ lọc hiện tại.</div>
      ) : (
        <div className={styles.reviewList}>
          {exchangeOrders.map((order) => {
            const totalProfitVnd =
              Number.parseFloat(order.feeProfitVnd) +
              Number.parseFloat(order.markupProfitVnd)

            return (
              <article className={styles.reviewCard} key={order.id}>
                <div className={styles.reviewTopRow}>
                  <div>
                    <h3 className={styles.reviewTitle}>
                      {order.fromAssetCode} {'->'} {order.toAssetCode}
                    </h3>
                    <p className={styles.reviewMeta}>
                      {buildAdminUserMetaLine({
                        createdAt: order.createdAt,
                        userEmail: order.userEmail,
                        userPhone: order.userPhone,
                      })}
                    </p>
                  </div>
                  <span
                    className={`${styles.reviewBadge} ${
                      order.status === 'reversed'
                        ? styles.reviewBadgeNeutral
                        : styles.reviewBadgeSuccess
                    }`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                </div>

                <div className={styles.reviewGrid}>
                  <InfoRow
                    label="Chiều đổi"
                    value={`${order.fromAssetCode} -> ${order.toAssetCode}`}
                  />
                  <InfoRow
                    label="Số tiền nguồn"
                    value={moneyLabel(order.requestedAmount, order.fromAssetCode)}
                  />
                  <InfoRow
                    label="Quy đổi trước phí"
                    value={moneyLabel(order.grossReceiveAmount, order.toAssetCode)}
                  />
                  <InfoRow
                    label="Số tiền nhận"
                    value={moneyLabel(order.toAmount, order.toAssetCode)}
                  />
                  <InfoRow
                    label="Phí giao dịch"
                    value={moneyLabel(order.feeAmount, order.feeAssetCode as 'USDT' | 'VND')}
                  />
                  <InfoRow
                    label="Tổng tiền trừ"
                    value={moneyLabel(order.totalDebit, order.fromAssetCode)}
                  />
                  <InfoRow label="Tỷ giá áp dụng" value={`${formatVnd(order.rate)} VND`} />
                  <InfoRow
                    label="Tỷ giá realtime"
                    value={`${formatVnd(order.realtimeRateVnd)} VND`}
                  />
                  <InfoRow label="Phí %" value={`${(order.feeBps / 100).toFixed(2)}%`} />
                  <InfoRow label="Markup" value={`${formatVnd(order.appliedMarkupVnd)} VND`} />
                  <InfoRow
                    label="Lợi nhuận từ % giao dịch"
                    value={`${formatVnd(order.feeProfitVnd)} đ`}
                  />
                  <InfoRow
                    label="Lợi nhuận từ markup"
                    value={`${formatVnd(order.markupProfitVnd)} đ`}
                  />
                  <InfoRow
                    label="Tổng lợi nhuận"
                    value={`${formatVnd(totalProfitVnd)} đ`}
                  />
                </div>

                {order.status === 'completed' && onReverse ? (
                  <div className={styles.reviewFooter}>
                    <button
                      type="button"
                      aria-label="Khôi phục đổi tiền"
                      className={styles.secondaryActionBtn}
                      disabled={submittingReverse}
                      onClick={() => void onReverse(order.id)}
                    >
                      <i className="fas fa-rotate-left" />{' '}
                      {submittingReverse
                        ? 'Đang khôi phục...'
                        : 'Khôi phục đổi tiền'}
                    </button>
                  </div>
                ) : (
                  <div className={styles.reviewFooter}>
                    <span>Chế độ chỉ xem cho lệnh đã khôi phục.</span>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export function SettingsSection({
  bannerFeedback,
  canManageTelegramRuntimeConfig,
  exchangeUsdtToVndFeeBpsInput,
  exchangeUsdtToVndMarkupVndInput,
  exchangeVndToUsdtFeeBpsInput,
  exchangeMarkupVndInput,
  feedback,
  homepageBanners,
  isDeletingBanner,
  isPending,
  isReorderingBanners,
  isSubmitting,
  isUploadingBanner,
  reservationTtlInput,
  onChange,
  onDeleteBanner,
  onReorderBanners,
  onSubmit,
  onTelegramRuntimeConfigChange,
  onTelegramRuntimeConfigSubmit,
  onUploadBanner,
  supportLinkInput,
  telegramRuntimeBotUsername,
  telegramRuntimeChatIdInput,
  telegramRuntimeFeedback,
  telegramRuntimeIsConfigured,
  telegramRuntimeIsPending,
  telegramRuntimeLastValidatedAt,
  telegramRuntimeTokenInput,
  telegramRuntimeTokenSuffix,
  telegramRuntimeUpdatedAt,
  telegramRuntimeVersion,
  withdrawalUsdtFeeBpsInput,
  withdrawalVndFeeBpsInput,
}: {
  bannerFeedback: FeedbackState | null
  canManageTelegramRuntimeConfig: boolean
  exchangeUsdtToVndFeeBpsInput: string
  exchangeUsdtToVndMarkupVndInput: string
  exchangeVndToUsdtFeeBpsInput: string
  exchangeMarkupVndInput: string
  feedback: FeedbackState | null
  homepageBanners: HomepageBanner[]
  isDeletingBanner: boolean
  isPending: boolean
  isReorderingBanners: boolean
  isSubmitting: boolean
  isUploadingBanner: boolean
  reservationTtlInput: string
  onChange: (
    patch: Partial<{
      exchangeUsdtToVndFeeBpsInput: string
      exchangeUsdtToVndMarkupVndInput: string
      exchangeVndToUsdtFeeBpsInput: string
      exchangeMarkupVndInput: string
      reservationTtlInput: string
      supportLinkInput: string
      telegramRuntimeChatIdInput: string
      telegramRuntimeTokenInput: string
      withdrawalUsdtFeeBpsInput: string
      withdrawalVndFeeBpsInput: string
    }>,
  ) => void
  onDeleteBanner: (bannerId: string) => void
  onReorderBanners: (bannerIds: string[]) => void
  onSubmit: () => void
  onTelegramRuntimeConfigChange: (
    patch: Partial<{
      telegramRuntimeChatIdInput: string
      telegramRuntimeTokenInput: string
    }>,
  ) => void
  onTelegramRuntimeConfigSubmit: () => void
  onUploadBanner: (file: File) => void
  supportLinkInput: string
  telegramRuntimeBotUsername: string | null
  telegramRuntimeChatIdInput: string
  telegramRuntimeFeedback: FeedbackState | null
  telegramRuntimeIsConfigured: boolean
  telegramRuntimeIsPending: boolean
  telegramRuntimeLastValidatedAt: string | null
  telegramRuntimeTokenInput: string
  telegramRuntimeTokenSuffix: string | null
  telegramRuntimeUpdatedAt: string | null
  telegramRuntimeVersion: number | null
  withdrawalUsdtFeeBpsInput: string
  withdrawalVndFeeBpsInput: string
}) {
  const [draggedBannerId, setDraggedBannerId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleBannerDrop = (targetBannerId: string) => {
    if (!draggedBannerId || draggedBannerId === targetBannerId) {
      setDraggedBannerId(null)
      return
    }

    const bannerIds = homepageBanners.map((banner) => banner.id)
    const fromIndex = bannerIds.indexOf(draggedBannerId)
    const toIndex = bannerIds.indexOf(targetBannerId)

    if (fromIndex < 0 || toIndex < 0) {
      setDraggedBannerId(null)
      return
    }

    const nextBannerIds = [...bannerIds]
    const [draggedId] = nextBannerIds.splice(fromIndex, 1)
    nextBannerIds.splice(toIndex, 0, draggedId)
    setDraggedBannerId(null)
    onReorderBanners(nextBannerIds)
  }

  return (
    <section className={styles.sectionCard}>
      {feedback ? (
        <div
          className={feedback.kind === 'success' ? styles.successMsg : styles.errorMsg}
        >
          <i
            className={
              feedback.kind === 'success'
                ? 'fas fa-check-circle'
                : 'fas fa-exclamation-circle'
            }
          />
          {feedback.message}
        </div>
      ) : null}

      <div className={styles.infoBox}>
        <i className="fas fa-clock" />
        <span>
          Reservation chỉ áp dụng cho <b>nạp VND qua ngân hàng</b>. Khi user bấm
          lấy thông tin nạp, hệ thống sẽ giữ chỗ theo số phút ở đây và chỉ đẩy
          request sang admin sau khi user bấm <b>Đã nạp tiền</b>.
        </span>
      </div>

      <div className={styles.bankFormCard}>
        <div className={styles.settingsSection}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitle}>Cấu hình giữ chỗ nạp VND</h2>
              <p className={styles.settingsCaption}>
                Chỉ áp dụng cho nạp VND qua ngân hàng; request chỉ vào hàng chờ
                duyệt sau khi user bấm "Đã nạp tiền".
              </p>
            </div>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label htmlFor="reservation-ttl-input">Thời gian giữ chỗ (phút)</label>
              <input
                id="reservation-ttl-input"
                type="number"
                min="1"
                placeholder={isPending ? 'Đang tải...' : '15'}
                value={reservationTtlInput}
                onChange={(event) =>
                  onChange({ reservationTtlInput: event.target.value })
                }
              />
            </div>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitle}>Tỷ giá và phí giao dịch</h2>
              <p className={styles.settingsCaption}>
                Đổi tiền hai chiều dùng giá realtime với markup mua/bán riêng và phí
                exchange riêng theo từng chiều.
              </p>
            </div>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label htmlFor="exchange-markup-vnd-input">Buy markup VND / 1 USDT</label>
              <input
                id="exchange-markup-vnd-input"
                type="number"
                min="0"
                placeholder="1000"
                value={exchangeMarkupVndInput}
                onChange={(event) =>
                  onChange({ exchangeMarkupVndInput: event.target.value })
                }
              />
              <small>
                Áp cho chiều người dùng mua USDT bằng VND.
              </small>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="exchange-sell-markup-vnd-input">Sell markup VND / 1 USDT</label>
              <input
                id="exchange-sell-markup-vnd-input"
                type="number"
                min="0"
                placeholder="700"
                value={exchangeUsdtToVndMarkupVndInput}
                onChange={(event) =>
                  onChange({ exchangeUsdtToVndMarkupVndInput: event.target.value })
                }
              />
              <small>
                Áp cho chiều người dùng bán USDT để nhận VND.
              </small>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="exchange-buy-fee-bps-input">Phí đổi VND -&gt; USDT (%)</label>
              <input
                id="exchange-buy-fee-bps-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="1"
                value={exchangeVndToUsdtFeeBpsInput}
                onChange={(event) =>
                  onChange({ exchangeVndToUsdtFeeBpsInput: event.target.value })
                }
              />
              <small>
                Nhập theo % thường. Ví dụ: 1 = 1%
              </small>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="exchange-sell-fee-bps-input">Phí đổi USDT -&gt; VND (%)</label>
              <input
                id="exchange-sell-fee-bps-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0.5"
                value={exchangeUsdtToVndFeeBpsInput}
                onChange={(event) =>
                  onChange({ exchangeUsdtToVndFeeBpsInput: event.target.value })
                }
              />
              <small>
                Nhập theo % thường. Ví dụ: 1 = 1%
              </small>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="withdrawal-vnd-fee-bps-input">Phí rút VND (%)</label>
              <input
                id="withdrawal-vnd-fee-bps-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="10"
                value={withdrawalVndFeeBpsInput}
                onChange={(event) =>
                  onChange({ withdrawalVndFeeBpsInput: event.target.value })
                }
              />
              <small>
                Nhập theo % thường. Ví dụ: 1 = 1%
              </small>
            </div>
            <div className={styles.modalField}>
              <label htmlFor="withdrawal-usdt-fee-bps-input">Phí rút USDT (%)</label>
              <input
                id="withdrawal-usdt-fee-bps-input"
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={withdrawalUsdtFeeBpsInput}
                onChange={(event) =>
                  onChange({ withdrawalUsdtFeeBpsInput: event.target.value })
                }
              />
              <small>
                Nhập theo % thường. Ví dụ: 1 = 1%
              </small>
            </div>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <div className={styles.sectionHeaderRow}>
            <div>
              <h2 className={styles.sectionTitle}>Hiển thị cho người dùng</h2>
              <p className={styles.settingsCaption}>
                Thay đổi ở đây cập nhật ngay trên dashboard, quên mật khẩu và khu
                vực hỗ trợ mà không cần rebuild client.
              </p>
            </div>
          </div>

          {canManageTelegramRuntimeConfig ? (
            <div className={styles.settingsSection}>
              <div className={styles.sectionHeaderRow}>
                <div>
                  <h2 className={styles.sectionTitle}>Telegram bot runtime</h2>
                  <p className={styles.settingsCaption}>
                    Chỉ super admin mới được đổi chat ID hoặc rotate token bot.
                    Cấu hình mới sẽ được validate rồi bot áp dụng tự động, không
                    cần restart.
                  </p>
                </div>
              </div>

              {telegramRuntimeFeedback ? (
                <div
                  className={
                    telegramRuntimeFeedback.kind === 'success'
                      ? styles.successMsg
                      : styles.errorMsg
                  }
                >
                  <i
                    className={
                      telegramRuntimeFeedback.kind === 'success'
                        ? 'fas fa-check-circle'
                        : 'fas fa-exclamation-circle'
                    }
                  />
                  {telegramRuntimeFeedback.message}
                </div>
              ) : null}

              <div className={styles.formGrid}>
                <div className={styles.modalField}>
                  <label htmlFor="telegram-runtime-chat-id-input">
                    Chat ID nhóm / kênh
                  </label>
                  <input
                    id="telegram-runtime-chat-id-input"
                    placeholder="-1001234567890"
                    type="text"
                    value={telegramRuntimeChatIdInput}
                    onChange={(event) =>
                      onTelegramRuntimeConfigChange({
                        telegramRuntimeChatIdInput: event.target.value,
                      })
                    }
                  />
                </div>
                <div className={styles.modalField}>
                  <label htmlFor="telegram-runtime-token-input">
                    Token bot mới
                  </label>
                  <input
                    id="telegram-runtime-token-input"
                    placeholder={
                      telegramRuntimeIsConfigured
                        ? 'Để trống nếu giữ token hiện tại'
                        : '123456:ABCDEF'
                    }
                    type="password"
                    value={telegramRuntimeTokenInput}
                    onChange={(event) =>
                      onTelegramRuntimeConfigChange({
                        telegramRuntimeTokenInput: event.target.value,
                      })
                    }
                  />
                  <small>
                    Token không bao giờ được trả về client. Nếu để trống, hệ
                    thống sẽ giữ token hiện tại.
                  </small>
                </div>
              </div>

              <div className={styles.infoBox}>
                <i className="fas fa-robot" />
                <span>
                  {telegramRuntimeIsConfigured ? 'Đang hoạt động' : 'Chưa cấu hình'}{' '}
                  · Token hiện tại:{' '}
                  <b>
                    {telegramRuntimeTokenSuffix
                      ? `...${telegramRuntimeTokenSuffix}`
                      : 'chưa có'}
                  </b>{' '}
                  · Bot: <b>{telegramRuntimeBotUsername ?? 'chưa xác thực'}</b>{' '}
                  · Version: <b>{telegramRuntimeVersion ?? 'n/a'}</b>{' '}
                  · Lần validate gần nhất:{' '}
                  <b>{telegramRuntimeLastValidatedAt ?? 'chưa có'}</b>{' '}
                  · Cập nhật: <b>{telegramRuntimeUpdatedAt ?? 'chưa có'}</b>
                </span>
              </div>

              <div className={styles.modalActions}>
                <button
                  className={styles.saveBtn}
                  disabled={telegramRuntimeIsPending}
                  onClick={onTelegramRuntimeConfigSubmit}
                  type="button"
                >
                  {telegramRuntimeIsPending
                    ? 'Đang áp dụng...'
                    : 'Lưu cấu hình Telegram'}
                </button>
              </div>
            </div>
          ) : null}

          <div className={styles.formGrid}>
            <div className={styles.modalField}>
              <label htmlFor="support-link-input">Link hỗ trợ</label>
              <input
                id="support-link-input"
                type="url"
                placeholder="https://t.me/nganluong_support"
                value={supportLinkInput}
                onChange={(event) =>
                  onChange({ supportLinkInput: event.target.value })
                }
              />
            </div>
          </div>

          <div className={styles.bannerSection}>
            <div className={styles.bannerSectionHeader}>
              <div>
                <h3 className={styles.bannerSectionTitle}>Banner trang chủ</h3>
                <p className={styles.bannerSectionCaption}>
                  Tối đa 5 ảnh, đúng ratio 16:5 và có thể kéo thả để đổi thứ tự.
                </p>
              </div>
              <button
                className={styles.secondaryActionBtn}
                disabled={homepageBanners.length >= 5 || isUploadingBanner}
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                {isUploadingBanner ? 'Đang tải ảnh...' : 'Chọn ảnh banner'}
              </button>
              <input
                ref={fileInputRef}
                accept="image/jpeg,image/png,image/webp"
                className={styles.hiddenInput}
                onChange={(event) => {
                  const file = event.target.files?.[0]

                  if (file) {
                    onUploadBanner(file)
                  }

                  event.target.value = ''
                }}
                type="file"
              />
            </div>

            {bannerFeedback ? (
              <div
                className={
                  bannerFeedback.kind === 'success'
                    ? styles.successMsg
                    : styles.errorMsg
                }
              >
                <i
                  className={
                    bannerFeedback.kind === 'success'
                      ? 'fas fa-check-circle'
                      : 'fas fa-exclamation-circle'
                  }
                />
                {bannerFeedback.message}
              </div>
            ) : null}

            {homepageBanners.length > 0 ? (
              <div className={styles.bannerList}>
                {homepageBanners.map((banner, index) => (
                  <article
                    key={banner.id}
                    className={`${styles.bannerItem} ${draggedBannerId === banner.id ? styles.bannerItemDragging : ''}`}
                    draggable={!isReorderingBanners}
                    onDragEnd={() => setDraggedBannerId(null)}
                    onDragOver={(event) => {
                      event.preventDefault()
                    }}
                    onDragStart={() => {
                      setDraggedBannerId(banner.id)
                    }}
                    onDrop={(event) => {
                      event.preventDefault()
                      handleBannerDrop(banner.id)
                    }}
                  >
                    <img
                      alt={`Banner ${index + 1}`}
                      className={styles.bannerPreviewImage}
                      src={resolveAssetUrl(banner.imageUrl)}
                    />
                    <div className={styles.bannerItemMeta}>
                      <div className={styles.bannerItemTitle}>
                        Banner #{index + 1}
                      </div>
                      <div className={styles.bannerItemCaption}>
                        {banner.width} x {banner.height}
                      </div>
                    </div>
                    <div className={styles.bannerItemActions}>
                      <span className={styles.bannerDragHint}>Kéo để đổi thứ tự</span>
                      <button
                        className={styles.deleteBtn}
                        disabled={isDeletingBanner}
                        onClick={() => onDeleteBanner(banner.id)}
                        type="button"
                      >
                        <i className="fas fa-trash" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.bannerEmptyState}>
                Chưa có banner ảnh nào. Trang chủ sẽ giữ banner mặc định hiện tại.
              </div>
            )}
          </div>
        </div>

        <div className={`${styles.infoBox} ${styles.settingsNote}`} role="note">
          <i className="fas fa-life-ring" />
          <div className={styles.settingsNoteBody}>
            <h3 className={styles.settingsNoteTitle}>Ngoại lệ vận hành</h3>
            <span>
              Reservation hết hạn nhưng user vẫn báo đã chuyển tiền thì admin đối
              soát thủ công.
            </span>
          </div>
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.saveBtn}
            disabled={isPending || isSubmitting}
            onClick={onSubmit}
            type="button"
          >
            {isSubmitting ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </section>
  )
}

function StatCard({
  className,
  icon,
  label,
  meta,
  value,
}: {
  className?: string
  icon: string
  label: string
  meta?: string
  value: string
}) {
  return (
    <div className={`${styles.statCard} ${className ?? ''}`.trim()}>
      <div className={styles.statIcon}>
        <i className={icon} />
      </div>
      <div className={styles.statInfo}>
        <div className={styles.statValue}>{value}</div>
        <div className={styles.statLabel}>{label}</div>
        {meta ? <div className={styles.reviewMeta}>{meta}</div> : null}
      </div>
    </div>
  )
}

function moneyLabel(amount: string, assetCode: string) {
  return `${assetCode === 'VND' ? formatVnd(amount) : formatUsdt(amount)} ${assetCode}`
}

function sortNewest<T extends { createdAt: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  )
}

function sortByPriority(items: AdminBankAccount[]) {
  return [...items].sort((left, right) => left.priority - right.priority)
}

function badgeClass(status: string) {
  if (status === 'approved' || status === 'completed') {
    return styles.reviewBadgeSuccess
  }

  if (status === 'rejected') {
    return styles.reviewBadgeDanger
  }

  return styles.reviewBadgePending
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoRowLabel}>{label}</span>
      <span className={styles.infoRowValue}>{value}</span>
    </div>
  )
}

type ReviewItem = {
  amount: string
  assetCode: string
  createdAt: string
  id: string
  method: string
  note?: string | null
  reviewNote?: string | null
  status: string
  userEmail?: string | null
  userPhone?: string | null
}

export function ReviewSection<T extends ReviewItem>({
  dateFilter,
  emptyMessage,
  filterBar,
  isPending,
  isRefreshing,
  items,
  loadingMessage,
  noteMap,
  onApprove,
  onNoteChange,
  onReject,
  onRefresh,
  onRestorePending,
  pendingLabel,
  renderDetails,
  searchBox,
  statusFilter,
  submittingApprove,
  submittingReject,
  submittingRestore,
}: {
  dateFilter?: ReactNode
  emptyMessage: string
  filterBar: ReactNode
  isPending: boolean
  isRefreshing: boolean
  items: T[]
  loadingMessage: string
  noteMap: Partial<Record<string, string>>
  onApprove: (id: string) => Promise<unknown>
  onNoteChange: (id: string, value: string) => void
  onReject: (id: string) => Promise<unknown>
  onRefresh: () => void
  onRestorePending?: (id: string) => Promise<unknown>
  pendingLabel: string
  renderDetails: (item: T) => ReactNode
  searchBox?: ReactNode
  statusFilter: AdminStatusFilter
  submittingApprove: boolean
  submittingReject: boolean
  submittingRestore?: boolean
}) {
  return (
    <section className={styles.sectionCard}>
      <div className={styles.sectionHeaderRow}>
        <div>
          <h2 className={styles.sectionTitle}>{pendingLabel}</h2>
          <p className={styles.sectionSub}>
            {adminStatusLabels[statusFilter]} - {items.length} yêu cầu
          </p>
        </div>
        <div className={styles.toolbarGroup}>
          {searchBox}
          {filterBar}
          {dateFilter}
          <ManualRefreshButton isRefreshing={isRefreshing} onClick={onRefresh} />
        </div>
      </div>

      {isPending ? (
        <div className={styles.queueEmpty}>{loadingMessage}</div>
      ) : items.length === 0 ? (
        <div className={styles.queueEmpty}>{emptyMessage}</div>
      ) : (
        <div className={styles.reviewList}>
          {items.map((item) => (
            <article key={item.id} className={styles.reviewCard}>
              <div className={styles.reviewTopRow}>
                <div>
                  <div className={styles.reviewTitle}>
                    {item.userEmail ?? `Yêu cầu #${item.id}`}
                  </div>
                  <div className={styles.reviewMeta}>
                    {buildAdminUserMetaLine({
                      createdAt: item.createdAt,
                      userEmail: item.userEmail,
                      userPhone: item.userPhone,
                    })}
                  </div>
                </div>
                <div className={`${styles.reviewBadge} ${badgeClass(item.status)}`}>
                  {getStatusLabel(item.status)}
                </div>
              </div>

              <div className={styles.reviewGrid}>{renderDetails(item)}</div>

              {item.status === 'pending' ? (
                <div className={styles.reviewActions}>
                  <input
                    className={styles.reviewNoteInput}
                    placeholder="Ghi chú review (tuỳ chọn)"
                    value={noteMap[item.id] ?? ''}
                    onChange={(event) => onNoteChange(item.id, event.target.value)}
                  />
                  <div className={styles.reviewButtonRow}>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      disabled={submittingApprove}
                      onClick={() => void onApprove(item.id)}
                    >
                      <i className="fas fa-check" /> Duyệt
                    </button>
                    <button
                      type="button"
                      className={styles.rejectBtn}
                      disabled={submittingReject}
                      onClick={() => void onReject(item.id)}
                    >
                      <i className="fas fa-times" /> Từ chối
                    </button>
                  </div>
                </div>
              ) : shouldShowRestorePendingAction({
                  itemStatus: item.status,
                  statusFilter,
                }) && onRestorePending ? (
                <div className={styles.reviewFooter}>
                  <button
                    type="button"
                    className={styles.secondaryActionBtn}
                    disabled={submittingRestore}
                    onClick={() => void onRestorePending(item.id)}
                  >
                    <i className="fas fa-rotate-left" />{' '}
                    {submittingRestore
                      ? 'Đang khôi phục...'
                      : 'Khôi phục chờ duyệt'}
                  </button>
                </div>
              ) : (
                <div className={styles.reviewFooter}>
                  <span>Chế độ chỉ xem theo bộ lọc hiện tại.</span>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function describeDestinationDetails(
  destinationDetails: WithdrawalDestinationDetails | null | undefined,
) {
  if (!destinationDetails) {
    return 'Chưa cung cấp'
  }

  if (destinationDetails.method === 'bank_transfer') {
    return `${destinationDetails.bankName} - ${destinationDetails.accountNumber} - ${destinationDetails.accountName}`
  }

  if (
    destinationDetails.method === 'bep20'
    || destinationDetails.method === 'trc20'
  ) {
    return `${destinationDetails.network} - ${destinationDetails.walletAddress}`
  }

  return destinationDetails.method
}
