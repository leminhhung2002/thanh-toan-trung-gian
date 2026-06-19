import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { BottomNav } from '#/components/bottom-nav'
import { FeedbackBanner } from '#/components/feedback-banner'
import { NotificationHistoryOverlay } from '#/features/history/notification-overlay'
import { NotificationBellButton } from '#/features/notifications/notification-bell-button'
import { ScreenLoader } from '#/components/screen-loader'
import { accountApi } from '#/features/account/api'
import { listVietQrBanks } from '#/features/admin/vietqr-banks'
import {
  canCreateDashboardDepositReservation,
  canEditDashboardDepositAmount,
  createDashboardDepositState,
  getDashboardDepositLimitMessage,
  getDashboardDepositAmountValue,
  getDashboardDepositPrimaryActionLabel,
  getDashboardDepositStep,
  validateDashboardDepositAmount,
} from '#/features/dashboard/deposit-flow'
import { DrawerBalances } from '#/features/dashboard/drawer-balances'
import { DashboardMethodSelector } from '#/features/dashboard/method-selector'
import { HomepageBannerCarousel } from '#/features/dashboard/homepage-banner-carousel'
import { WithdrawAmountField } from '#/features/dashboard/withdraw-amount-field'
import {
  buildWithdrawalDestinationDetails,
  createDashboardWithdrawalState,
  getWithdrawalMinimumRequiredMessage,
  validateWithdrawalCurrentPassword,
  validateWithdrawalAmount,
  validateWithdrawalNetReceive,
} from '#/features/dashboard/withdrawal-flow'
import {
  calculateFeePreview,
  formatBpsPercent,
  getFinancialSettingsGate,
} from '#/features/wallet/fees'
import { walletApi } from '#/features/wallet/api'
import {
  formatReservationCountdown,
  getReservationSecondsLeft,
  isReservationExpired,
} from '#/features/wallet/reservation'
import { shouldBlockDashboardOnLoad } from '#/features/wallet/ui'
import { buildVietQrImageUrl } from '#/features/wallet/vietqr'
import { translateApiError } from '#/lib/api/error-copy'
import { queryKeys } from '#/lib/query-keys'
import { useDisplaySettings } from '#/lib/settings/use-display-settings'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import { findWalletByAssetCode } from '#/lib/utils/wallets'
import styles from '../../routes/dashboard.module.css'

const defaultDepositState = createDashboardDepositState()
const defaultWithdrawalState = createDashboardWithdrawalState('')

type DashboardFeedback = {
  kind: 'error' | 'success'
  message: string
}

function LegacyHomepageBanner() {
  return (
    <div className={styles.bannerCard}>
      <div className={styles.bannerSlogan1}>CỔNG THANH TOÁN</div>
      <div className={styles.bannerSlogan2}>ĐA KÊNH UY TÍN</div>
      <div className={styles.bannerNumber}>
        10
        <span>
          NĂM
          <br />
          ĐỒNG
          <br />
          HÀNH
        </span>
      </div>
      <div className={styles.dots}>
        <div className={`${styles.dot} ${styles.active}`}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
        <div className={styles.dot}></div>
      </div>
    </div>
  )
}

function normalizeWithdrawalAmountInput(value: string, assetCode: 'USDT' | 'VND') {
  if (assetCode === 'VND') {
    return value.replace(/\D/g, '')
  }

  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [whole, ...rest] = normalized.split('.')
  const decimals = rest.join('').slice(0, 2)

  return decimals.length > 0 ? `${whole}.${decimals}` : whole
}

export function DashboardScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { displaySettings } = useDisplaySettings()
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [depositAmount, setDepositAmount] = useState(defaultDepositState.amount)
  const [depositError, setDepositError] = useState(defaultDepositState.error)
  const [depositStep, setDepositStep] = useState<'entry' | 'payment'>(defaultDepositState.step)
  const [showDepositSuccessCard, setShowDepositSuccessCard] = useState(false)
  const [reservationNow, setReservationNow] = useState(() => Date.now())
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null)
  const [withdrawTab, setWithdrawTab] = useState<'usdt' | 'vnd'>(defaultWithdrawalState.tab)
  const [withdrawAmount, setWithdrawAmount] = useState(defaultWithdrawalState.amount)
  const [withdrawBankName, setWithdrawBankName] = useState(defaultWithdrawalState.bankName)
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState(
    defaultWithdrawalState.accountNumber,
  )
  const [withdrawAccountName, setWithdrawAccountName] = useState(
    defaultWithdrawalState.accountName,
  )
  const [withdrawWalletAddress, setWithdrawWalletAddress] = useState(
    defaultWithdrawalState.walletAddress,
  )
  const [withdrawNetwork, setWithdrawNetwork] = useState(defaultWithdrawalState.network)
  const [withdrawCurrentPassword, setWithdrawCurrentPassword] = useState('')
  const [pageFeedback, setPageFeedback] = useState<DashboardFeedback | null>(null)
  const [withdrawalFeedback, setWithdrawalFeedback] = useState<DashboardFeedback | null>(
    null,
  )

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: walletApi.listWallets,
  })
  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: accountApi.getProfile,
  })
  const financialSettingsQuery = useQuery({
    queryKey: queryKeys.financialSettings,
    queryFn: walletApi.getFinancialSettings,
    staleTime: 1000 * 60 * 5,
  })
  const vietQrBanksQuery = useQuery({
    enabled: showWithdrawalModal && withdrawTab === 'vnd',
    queryKey: queryKeys.vietQrBanks,
    queryFn: () => listVietQrBanks(),
    staleTime: 1000 * 60 * 60,
  })
  const liveReservationsQuery = useQuery({
    enabled: showDepositModal,
    queryKey: queryKeys.depositReservations,
    queryFn: walletApi.listDepositReservations,
    refetchInterval: showDepositModal ? 10_000 : false,
  })

  const depositReservationMutation = useMutation({
    mutationFn: walletApi.createDepositReservation,
    onSuccess: (result) => {
      queryClient.setQueryData(queryKeys.depositReservations, (current: typeof result[] | undefined) => [
        result,
        ...((current ?? []).filter((reservation) => reservation.status === 'pending_review')),
      ])
      setDepositError('')
      setDepositStep('payment')
    },
  })
  const confirmReservationMutation = useMutation({
    mutationFn: walletApi.confirmDepositReservation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.depositReservations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals }),
      ])
      setDepositError('')
      setDepositStep('payment')
      setShowDepositSuccessCard(true)
      setPageFeedback(null)
    },
    onError: (error) => {
      setDepositError(translateApiError(error, 'Không thể xác nhận đã nạp tiền'))
    },
  })
  const cancelReservationMutation = useMutation({
    mutationFn: walletApi.cancelDepositReservation,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.depositReservations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.deposits }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
      ])
      setDepositError('')
      setDepositStep('entry')
      setPageFeedback({
        kind: 'success',
        message: 'Đã hủy giữ chỗ nạp tiền.',
      })
    },
    onError: (error) => {
      setDepositError(translateApiError(error, 'Không thể hủy giữ chỗ nạp tiền'))
    },
  })
  const withdrawalMutation = useMutation({
    mutationFn: walletApi.createWithdrawal,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notificationUnreadCount }),
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications(50) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.withdrawals }),
      ])
      setWithdrawalFeedback(null)
      setShowWithdrawalModal(false)
      setPageFeedback(null)
    },
    onError: (error) => {
      setWithdrawalFeedback({
        kind: 'error',
        message: translateApiError(error, 'Lỗi rút tiền'),
      })
    },
  })

  const wallets = walletsQuery.data ?? []
  const profile = profileQuery.data
  const vndWallet = findWalletByAssetCode(wallets, 'VND')
  const usdtWallet = findWalletByAssetCode(wallets, 'USDT')
  const depositTab = 'vnd' as const
  const withdrawalFeeBps =
    withdrawTab === 'vnd'
      ? (financialSettingsQuery.data?.withdrawalVndFeeBps ?? null)
      : (financialSettingsQuery.data?.withdrawalUsdtFeeBps ?? null)
  const withdrawalFeeGate = getFinancialSettingsGate({
    context: 'withdrawal',
    isError: financialSettingsQuery.isError,
    isPending: financialSettingsQuery.isPending,
    settings: financialSettingsQuery.data,
  })
  const withdrawalPreview =
    withdrawalFeeGate.isReady && withdrawalFeeBps !== null
      ? calculateFeePreview(withdrawAmount, withdrawalFeeBps, withdrawTab === 'vnd' ? 'VND' : 'USDT')
      : null
  const availableBalance =
    withdrawTab === 'vnd'
      ? Number.parseFloat(vndWallet?.balances.available ?? '0')
      : Number.parseFloat(usdtWallet?.balances.available ?? '0')
  const withdrawalMinimumRequiredMessage = withdrawalPreview
    ? getWithdrawalMinimumRequiredMessage({
        assetCode: withdrawTab === 'vnd' ? 'VND' : 'USDT',
        availableBalance,
        netReceive: withdrawalPreview.netReceive,
        totalDebit: withdrawalPreview.totalDebit,
      })
    : null

  const displayName = useMemo(() => {
    const email = profile?.email ?? ''
    return email.split('@')[0] || email
  }, [profile?.email])

  const liveReservations = liveReservationsQuery.data ?? []
  const vietQrBanks = vietQrBanksQuery.data ?? []
  const activeReservation =
    liveReservations.find((reservation) => reservation.status === 'active') ?? null
  const pendingReviewReservations = liveReservations.filter(
    (reservation) => reservation.status === 'pending_review',
  )
  const pendingReviewCount = pendingReviewReservations.length
  const hasActiveReservation = Boolean(activeReservation)
  const currentDepositStep = getDashboardDepositStep({
    currentStep: depositStep,
    hasActiveReservation,
    tab: depositTab,
  })
  const canEditDepositAmount = canEditDashboardDepositAmount({
    hasActiveReservation,
    tab: depositTab,
  })
  const canCreateDepositReservation = canCreateDashboardDepositReservation({
    hasActiveReservation,
    pendingReviewCount,
  })
  const depositLimitMessage = getDashboardDepositLimitMessage({
    pendingReviewCount,
  })

  useEffect(() => {
    if (!activeReservation?.expiresAt) {
      return
    }

    setReservationNow(Date.now())

    const timer = window.setInterval(() => {
      setReservationNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(timer)
    }
  }, [activeReservation?.expiresAt])

  if (
    shouldBlockDashboardOnLoad({
      currentReservationPending: liveReservationsQuery.isPending,
      profilePending: profileQuery.isPending,
      showDepositModal,
      walletsPending: walletsQuery.isPending,
    })
  ) {
    return <ScreenLoader />
  }

  const resetDepositState = () => {
    setDepositAmount(defaultDepositState.amount)
    setDepositError('')
    setDepositStep('entry')
    setShowDepositSuccessCard(false)
    setReservationNow(Date.now())
  }

  const closeDepositModal = () => {
    if (
      depositReservationMutation.isPending ||
      confirmReservationMutation.isPending ||
      cancelReservationMutation.isPending
    ) {
      return
    }

    setShowDepositModal(false)
  }

  const openDepositModal = () => {
    resetDepositState()
    setPageFeedback(null)
    setShowDepositModal(true)
  }

  const openWithdrawalModal = () => {
    setWithdrawTab('vnd')
    setWithdrawAmount('25000')
    setWithdrawBankName('')
    setWithdrawAccountNumber('')
    setWithdrawAccountName(displayName)
    setWithdrawWalletAddress('')
    setWithdrawNetwork('BEP20')
    setWithdrawCurrentPassword('')
    setWithdrawalFeedback(null)
    setPageFeedback(null)
    setShowWithdrawalModal(true)
  }

  const createOrRefreshVndReservation = async () => {
    const validationError = validateDashboardDepositAmount(depositAmount)
    if (validationError) {
      setDepositError(validationError)
      return
    }

    const normalizedAmount = depositAmount.trim()

    setDepositError('')

    try {
      const refreshed = await liveReservationsQuery.refetch()
      const refreshedActiveReservation =
        refreshed.data?.find((reservation) => reservation.status === 'active') ?? null
      const refreshedPendingReviewCount =
        refreshed.data?.filter((reservation) => reservation.status === 'pending_review').length ?? 0

      if (refreshedActiveReservation) {
        setDepositStep('payment')
        setReservationNow(Date.now())
        return
      }

      if (refreshedPendingReviewCount >= 10) {
        setDepositStep('entry')
        return
      }

      const result = await depositReservationMutation.mutateAsync({
        amount: normalizedAmount,
        assetCode: 'VND',
        method: 'bank_transfer',
      })

      if (!result.selectedBankAccount) {
        setDepositError('Không nhận được thông tin thanh toán.')
        return
      }

      setDepositStep('payment')
      setReservationNow(Date.now())
    } catch (error) {
      const refreshed = await liveReservationsQuery.refetch()
      const refreshedActiveReservation =
        refreshed.data?.find((reservation) => reservation.status === 'active') ?? null

      if (refreshedActiveReservation) {
        setDepositError('')
        setDepositStep('payment')
        return
      }

      setDepositError(translateApiError(error, 'Lỗi nạp tiền'))
    }
  }

  const confirmDepositReservation = async () => {
    if (!activeReservation) {
      return
    }

    setDepositError('')
    await confirmReservationMutation.mutateAsync(activeReservation.reservationId)
  }

  const cancelDepositReservation = async (reservationId: string) => {
    setCancellingReservationId(reservationId)
    setDepositError('')

    try {
      await cancelReservationMutation.mutateAsync(reservationId)
    } finally {
      setCancellingReservationId(null)
    }
  }

  const submitWithdrawal = async () => {
    setWithdrawalFeedback(null)

    const validationError = validateWithdrawalAmount(withdrawAmount)
    if (validationError) {
      setWithdrawalFeedback({
        kind: 'error',
        message: validationError,
      })
      return
    }

    const normalizedAmount = withdrawAmount.trim()
    const destinationResult = buildWithdrawalDestinationDetails({
      accountName: withdrawAccountName,
      accountNumber: withdrawAccountNumber,
      bankName: withdrawBankName,
      network: withdrawNetwork,
      tab: withdrawTab,
      walletAddress: withdrawWalletAddress,
    })

    if (destinationResult.error || !destinationResult.destinationDetails) {
      setWithdrawalFeedback({
        kind: 'error',
        message:
          destinationResult.error ?? 'Vui lòng kiểm tra lại thông tin rút tiền.',
      })
      return
    }

    if (!withdrawalFeeGate.isReady || !withdrawalPreview) {
      setWithdrawalFeedback({
        kind: 'error',
        message: withdrawalFeeGate.message,
      })
      return
    }

    const netReceiveValidationError = validateWithdrawalNetReceive({
      assetCode: withdrawTab === 'vnd' ? 'VND' : 'USDT',
      feeAmount: withdrawalPreview.feeAmount,
      netReceive: withdrawalPreview.netReceive,
    })

    if (netReceiveValidationError) {
      setWithdrawalFeedback({
        kind: 'error',
        message: netReceiveValidationError,
      })
      return
    }

    if (withdrawalPreview.totalDebit > availableBalance) {
      setWithdrawalFeedback({
        kind: 'error',
        message:
          withdrawalMinimumRequiredMessage
          ?? 'Tổng trừ vượt quá số dư hiện tại.',
      })
      return
    }

    const currentPasswordError = validateWithdrawalCurrentPassword(
      withdrawCurrentPassword,
    )

    if (currentPasswordError) {
      setWithdrawalFeedback({
        kind: 'error',
        message: currentPasswordError,
      })
      return
    }

    const normalizedNetwork =
      withdrawTab === 'usdt' && withdrawNetwork.trim().toUpperCase() === 'TRC20'
        ? 'TRC20'
        : 'BEP20'
    const withdrawalMethod =
      withdrawTab === 'vnd' ? 'bank_transfer' : normalizedNetwork.toLowerCase()

    await withdrawalMutation.mutateAsync({
      amount: normalizedAmount,
      assetCode: withdrawTab === 'vnd' ? 'VND' : 'USDT',
      destinationDetails: destinationResult.destinationDetails,
      method: withdrawalMethod,
      note:
        withdrawTab === 'vnd'
          ? `Rút VND về ${withdrawAccountName.trim()}`
          : `Rút USDT qua mạng ${normalizedNetwork}`,
      currentPassword: withdrawCurrentPassword,
    })
  }

  const selectedDepositBank = activeReservation?.selectedBankAccount ?? null
  const selectedDepositQr =
    selectedDepositBank && activeReservation
      ? buildVietQrImageUrl({
          accountName: selectedDepositBank.accountName,
          accountNumber: selectedDepositBank.accountNumber,
          amount: activeReservation.amount,
          bankCode: selectedDepositBank.bankCode,
          transferContent: activeReservation.transferContent,
        })
      : null
  const reservationSecondsLeft = activeReservation
    ? getReservationSecondsLeft(activeReservation.expiresAt, reservationNow)
    : 0
  const reservationExpired = activeReservation
    ? isReservationExpired(activeReservation.expiresAt, reservationNow)
    : false
  const depositPrimaryActionLabel = getDashboardDepositPrimaryActionLabel({
    hasActiveReservation,
    reservationExpired,
    step: currentDepositStep,
    tab: depositTab,
  })

  const handleDepositPrimaryAction = async () => {
    if (currentDepositStep === 'entry') {
      await createOrRefreshVndReservation()
      return
    }

    if (reservationExpired) {
      await createOrRefreshVndReservation()
      return
    }

    await confirmDepositReservation()
  }

  const handleContinueDeposit = () => {
    setPageFeedback(null)
    resetDepositState()
  }

  const depositAmountValue = getDashboardDepositAmountValue({
    currentReservationAmount: activeReservation?.amount ?? '',
    depositAmount,
    hasCurrentReservation: hasActiveReservation,
    tab: depositTab,
  })
  const depositActionPending =
    currentDepositStep === 'entry'
      ? depositReservationMutation.isPending || liveReservationsQuery.isFetching
      : reservationExpired
        ? depositReservationMutation.isPending || liveReservationsQuery.isFetching
        : confirmReservationMutation.isPending

  return (
    <div className={styles.container}>
      {pageFeedback ? (
        <FeedbackBanner kind={pageFeedback.kind} message={pageFeedback.message} />
      ) : null}

      <div className={styles.header}>
        <div className={styles.headerTitle}>Tài khoản trung gian</div>
        <NotificationBellButton
          ariaLabel="Mở thông báo"
          buttonClassName={styles.mailButton}
          iconClassName={styles.mailIcon}
          onClick={() => setShowNotifications(true)}
        />
      </div>

      <div className={styles.cardArea}>
        <div className={styles.cardContent}>
          <div className={styles.shapeTopRightBlack}></div>
          <div className={styles.shapeTopRightOrange}></div>
          <div className={styles.shapeBottomLeftGreen}></div>
          <div className={styles.shapeBottomLeftOrange}></div>

          <div className={styles.balanceBlock}>
            <div className={styles.balanceLabelRow}>
              <span>Số dư tài khoản</span>
              <i className="fas fa-wallet"></i>
            </div>

            <div className={styles.balanceRow}>
              <span className={styles.currencyTag}>VND</span>
              <div className={styles.balanceValueBox}>
                {formatVnd(vndWallet?.balances.available ?? '0')}
              </div>
            </div>

            <div className={styles.balanceRow}>
              <span className={`${styles.currencyTag} ${styles.currencyUsdt}`}>USDT</span>
              <div className={styles.balanceValueBox}>
                {formatUsdt(usdtWallet?.balances.available ?? '0')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.actionRow}>
        <div className={styles.actionBtn} onClick={openDepositModal}>
          <div className={`${styles.iconWrap} ${styles.iconDeposit}`}>
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <span className={styles.actionText}>Nạp tiền</span>
        </div>
        <div className={styles.actionBtn} onClick={openWithdrawalModal}>
          <div className={`${styles.iconWrap} ${styles.iconWithdraw}`}>
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <span className={styles.actionText}>Rút tiền</span>
        </div>
        <div
          className={styles.actionBtn}
          onClick={() => navigate({ to: '/exchange' })}
          style={{ cursor: 'pointer' }}
        >
          <div className={`${styles.iconWrap} ${styles.iconExchange}`}>
            <i className="fas fa-sync-alt"></i>
          </div>
          <span className={styles.actionTextBold}>Đổi VND sang USDT</span>
        </div>
      </div>

      <div className={styles.bannerArea}>
        <HomepageBannerCarousel
          banners={displaySettings.homepageBanners}
          fallback={<LegacyHomepageBanner />}
        />
      </div>

      <NotificationHistoryOverlay
        onClose={() => setShowNotifications(false)}
        open={showNotifications}
      />

      <BottomNav active="dashboard" />

      {showDepositModal ? (
        <div className={styles.overlay} onClick={closeDepositModal}>
          <div
            className={styles.drawer}
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>Nạp Tiền</div>
              <div className={styles.drawerHeaderActions}>
                <button
                  type="button"
                  className={`fas fa-times ${styles.closeIcon}`}
                  onClick={closeDepositModal}
                ></button>
              </div>
            </div>

            <DrawerBalances
              usdtAvailable={usdtWallet?.balances.available ?? '0'}
              vndAvailable={vndWallet?.balances.available ?? '0'}
            />

            <div className={styles.sectionLabel}>Nạp VNĐ bằng chuyển khoản ngân hàng</div>

            {depositError ? (
              <div className={styles.errorBox}>
                <i className="fas fa-exclamation-circle" />
                <span>{depositError}</span>
              </div>
            ) : null}

            {liveReservationsQuery.isPending ? (
              <div className={styles.loadingBox}>
                <i className="fas fa-spinner fa-spin" />
                <span>Đang tải thông tin thanh toán...</span>
              </div>
            ) : showDepositSuccessCard ? (
              <div className={styles.paymentCard}>
                <div className={styles.statusCard}>
                  <div className={styles.statusTitle}>
                    <i className="fas fa-check-circle" />
                    <span>Đã ghi nhận thanh toán</span>
                  </div>
                  <p className={styles.statusText}>
                    Đã ghi nhận thanh toán. Vui lòng chờ xác nhận.
                  </p>
                </div>

                <button
                  className={styles.submitBtn}
                  onClick={handleContinueDeposit}
                  type="button"
                >
                  Tiếp tục nạp
                </button>
              </div>
            ) : currentDepositStep === 'entry' ? (
              <>
                {depositLimitMessage ? (
                  <div className={styles.helperBox}>
                    <i className="fas fa-layer-group" /> {depositLimitMessage}
                  </div>
                ) : null}

                <div className={styles.inputGroup}>
                  <div className={styles.label}>Số tiền nạp</div>
                  <input
                    type="number"
                    className={styles.inputField}
                    disabled={!canEditDepositAmount || !canCreateDepositReservation}
                    placeholder="Nhập số tiền VND"
                    value={depositAmountValue}
                    onChange={(event) => setDepositAmount(event.target.value)}
                  />
                </div>

                <button
                  className={styles.submitBtn}
                  disabled={depositActionPending || !canCreateDepositReservation}
                  onClick={() => void handleDepositPrimaryAction()}
                  type="button"
                >
                  {depositActionPending
                    ? 'Đang xử lý...'
                    : !canCreateDepositReservation && depositLimitMessage
                      ? 'Đã đạt giới hạn'
                      : depositPrimaryActionLabel}
                </button>
              </>
            ) : activeReservation && selectedDepositBank ? (
              <div className={styles.paymentCard}>
                <div className={styles.paymentCardHeader}>
                  <div>
                    <div className={styles.paymentCardTitle}>VNĐ</div>
                    <div className={styles.paymentCardMeta}>Chuyển khoản ngân hàng</div>
                  </div>
                  <div className={styles.countdownBox}>
                    {reservationExpired
                      ? 'Hết hạn'
                      : formatReservationCountdown(reservationSecondsLeft)}
                  </div>
                </div>

                {selectedDepositQr ? (
                  <>
                    <div className={styles.qrWrapper}>
                      <img src={selectedDepositQr} alt="VietQR" className={styles.qrImage} />
                    </div>
                    <div className={styles.noteText}>
                      Quét mã hoặc sao chép thông tin để tiếp tục.
                    </div>
                  </>
                ) : null}

                <div className={styles.infoBox}>
                  <div className={styles.infoLine}>
                    <span className={styles.infoLabel}>Ngân hàng</span>
                    <span className={styles.infoValue}>{selectedDepositBank.bankName}</span>
                  </div>
                  <div className={styles.infoLine}>
                    <span className={styles.infoLabel}>Số tài khoản</span>
                    <span className={styles.infoValue}>{selectedDepositBank.accountNumber}</span>
                  </div>
                  <div className={styles.infoLine}>
                    <span className={styles.infoLabel}>Tên tài khoản</span>
                    <span className={styles.infoValue}>{selectedDepositBank.accountName}</span>
                  </div>
                  <div className={styles.infoLine}>
                    <span className={styles.infoLabel}>Số tiền</span>
                    <span className={styles.infoValue}>
                      {formatVnd(activeReservation.amount)}
                    </span>
                  </div>
                  <div className={styles.infoLine}>
                    <span className={styles.infoLabel}>Nội dung</span>
                    <span className={styles.infoValue}>
                      {activeReservation.transferContent}
                    </span>
                  </div>
                </div>

                <div className={styles.buttonRow}>
                  {!reservationExpired ? (
                    <button
                      className={styles.secondaryBtn}
                      disabled={cancelReservationMutation.isPending}
                      onClick={() => void cancelDepositReservation(activeReservation.reservationId)}
                      type="button"
                    >
                      {cancelReservationMutation.isPending
                        && cancellingReservationId === activeReservation.reservationId
                        ? 'Đang hủy...'
                        : 'Hủy'}
                    </button>
                  ) : null}
                  <button
                    className={styles.submitBtn}
                    disabled={depositActionPending}
                    onClick={() => void handleDepositPrimaryAction()}
                    type="button"
                  >
                    {depositActionPending ? 'Đang xử lý...' : depositPrimaryActionLabel}
                  </button>
                </div>
              </div>
            ) : null}

          </div>
        </div>
      ) : null}

      {showWithdrawalModal ? (
        <div
          className={styles.overlay}
          onClick={() => {
            if (!withdrawalMutation.isPending) {
              setShowWithdrawalModal(false)
            }
          }}
        >
          <div
            className={styles.drawer}
            onClick={(event) => {
              event.stopPropagation()
            }}
          >
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>Rút Tiền</div>
              <div className={styles.drawerHeaderActions}>
                <button
                  type="button"
                  className={`fas fa-times ${styles.closeIcon}`}
                  onClick={() => {
                    if (!withdrawalMutation.isPending) {
                      setShowWithdrawalModal(false)
                    }
                  }}
                ></button>
              </div>
            </div>

            <DrawerBalances
              usdtAvailable={usdtWallet?.balances.available ?? '0'}
              vndAvailable={vndWallet?.balances.available ?? '0'}
            />

            <DashboardMethodSelector
              flow="withdrawal"
              onSelect={(value) => {
                setWithdrawTab(value)
                setWithdrawNetwork('BEP20')
                setWithdrawAmount(
                  value === 'vnd'
                    ? createDashboardWithdrawalState(displayName).amount
                    : '',
                )
                setWithdrawBankName(
                  value === 'vnd'
                    ? createDashboardWithdrawalState(displayName).bankName
                    : '',
                )
                setWithdrawAccountNumber(
                  value === 'vnd'
                    ? createDashboardWithdrawalState(displayName).accountNumber
                    : '',
                )
                setWithdrawAccountName(
                  value === 'vnd'
                    ? createDashboardWithdrawalState(displayName).accountName
                    : displayName,
                )
                setWithdrawWalletAddress(
                  value === 'vnd'
                    ? createDashboardWithdrawalState(displayName).walletAddress
                    : '',
                )
                setWithdrawalFeedback(null)
              }}
              selectedValue={withdrawTab}
            />

            <WithdrawAmountField
              feeHint={`Phí rút ${
                withdrawalFeeBps !== null ? formatBpsPercent(withdrawalFeeBps) : '--'
              }: ${
                withdrawalPreview
                  ? withdrawTab === 'vnd'
                    ? `${formatVnd(withdrawalPreview.feeAmount)} VND`
                    : `${formatUsdt(withdrawalPreview.feeAmount)} USDT`
                  : '--'
              }`}
              label={`Số tiền bạn muốn rút (${withdrawTab === 'vnd' ? 'VND' : 'USDT'})`}
              onChange={(value) =>
                setWithdrawAmount(
                  normalizeWithdrawalAmountInput(
                    value,
                    withdrawTab === 'vnd' ? 'VND' : 'USDT',
                  ),
                )
              }
              onMax={() =>
                setWithdrawAmount(
                  normalizeWithdrawalAmountInput(
                    withdrawTab === 'vnd'
                      ? (vndWallet?.balances.available ?? '0')
                      : (usdtWallet?.balances.available ?? '0'),
                    withdrawTab === 'vnd' ? 'VND' : 'USDT',
                  ),
                )
              }
              value={withdrawAmount}
            />

            {withdrawTab === 'vnd' ? (
              <>
                <div className={styles.inputGroup}>
                  <label className={styles.label} htmlFor="withdraw-bank-name">
                    Ngân hàng thụ hưởng
                  </label>
                  <select
                    id="withdraw-bank-name"
                    aria-label="Ngân hàng thụ hưởng"
                    className={styles.inputField}
                    value={withdrawBankName}
                    onChange={(event) => setWithdrawBankName(event.target.value)}
                  >
                    <option value="">
                      {vietQrBanksQuery.isPending ? 'Đang tải danh sách...' : 'Chọn ngân hàng'}
                    </option>
                    {vietQrBanks.map((bank) => (
                      <option key={`${bank.code}-${bank.bin}`} value={bank.shortName}>
                        {bank.shortName} ({bank.bin})
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.label}>Số tài khoản</div>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Nhập số tài khoản"
                    value={withdrawAccountNumber}
                    onChange={(event) => setWithdrawAccountNumber(event.target.value)}
                  />
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.label}>Tên chủ tài khoản</div>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Nhập tên chủ tài khoản"
                    value={withdrawAccountName}
                    onChange={(event) => setWithdrawAccountName(event.target.value)}
                  />
                </div>
              </>
            ) : (
              <>
                <div className={styles.inputGroup}>
                  <div className={styles.label}>Mạng lưới</div>
                  <div className={styles.networkTabs}>
                    {(['BEP20', 'TRC20'] as const).map((network) => (
                      <button
                        key={network}
                        type="button"
                        className={`${styles.networkTab} ${withdrawNetwork === network ? styles.networkTabActive : ''}`}
                        onClick={() => setWithdrawNetwork(network)}
                      >
                        {network}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.inputGroup}>
                  <div className={styles.label}>Địa chỉ ví USDT</div>
                  <input
                    type="text"
                    className={styles.inputField}
                    placeholder="Nhập địa chỉ ví nhận"
                    value={withdrawWalletAddress}
                    onChange={(event) => setWithdrawWalletAddress(event.target.value)}
                  />
                </div>
              </>
            )}

            <div className={styles.withdrawSummaryCard}>
              <div className={styles.withdrawSummaryLabel}>Bạn sẽ nhận</div>
              <div className={styles.withdrawSummaryAmount}>
                {withdrawalPreview
                  ? withdrawTab === 'vnd'
                    ? `${formatVnd(withdrawalPreview.netReceive)} VND`
                    : `${formatUsdt(withdrawalPreview.netReceive)} USDT`
                  : '--'}
              </div>
            </div>

            {withdrawalMinimumRequiredMessage ? (
              <div className={styles.withdrawSummaryWarning}>
                {withdrawalMinimumRequiredMessage}
              </div>
            ) : null}

            {!withdrawalFeeGate.isReady ? (
              <FeedbackBanner kind="error" message={withdrawalFeeGate.message} />
            ) : null}

            {withdrawalFeedback ? (
              <FeedbackBanner
                kind={withdrawalFeedback.kind}
                message={withdrawalFeedback.message}
              />
            ) : null}

            <div className={styles.inputGroup}>
              <div className={styles.label}>Mật khẩu hiện tại</div>
              <input
                type="password"
                className={styles.inputField}
                placeholder="Nhập mật khẩu hiện tại"
                value={withdrawCurrentPassword}
                onChange={(event) => setWithdrawCurrentPassword(event.target.value)}
              />
            </div>

            <button
              className={styles.submitBtn}
              onClick={() => void submitWithdrawal()}
              disabled={withdrawalMutation.isPending || !withdrawalFeeGate.isReady}
              type="button"
            >
              {withdrawalMutation.isPending
                ? 'Đang xử lý...'
                : 'Tạo yêu cầu rút tiền'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
