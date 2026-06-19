import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ScreenLoader } from '#/components/screen-loader'
import { RequireUser } from '#/features/auth/route-gates'
import { exchangeApi } from '#/features/exchange/api'
import {
  getExchangeAssetTone,
  getExchangeBalanceCardUi,
  type ExchangeDirection,
} from '#/features/exchange/ui'
import { formatBpsPercent, getFinancialSettingsGate } from '#/features/wallet/fees'
import { walletApi } from '#/features/wallet/api'
import { translateApiError } from '#/lib/api/error-copy'
import { queryKeys } from '#/lib/query-keys'
import { formatUsdt, formatVnd } from '#/lib/utils/format'
import { findWalletByAssetCode } from '#/lib/utils/wallets'
import styles from './exchange.module.css'

export const Route = createFileRoute('/exchange')({
  component: ExchangeRoute,
})

function ExchangeRoute() {
  return (
    <RequireUser>
      <ExchangeScreen />
    </RequireUser>
  )
}

function sanitizeExchangeInput(value: string, direction: ExchangeDirection) {
  if (direction === 'vnd_to_usdt') {
    const normalized = value.replace(/\D/g, '')
    return normalized ? Number(normalized).toLocaleString('vi-VN') : ''
  }

  const normalized = value.replace(/,/g, '.').replace(/[^\d.]/g, '')
  const [whole, ...rest] = normalized.split('.')
  const decimals = rest.join('').slice(0, 2)

  return decimals.length > 0 ? `${whole}.${decimals}` : whole
}

function parseSourceAmount(value: string, direction: ExchangeDirection) {
  if (direction === 'vnd_to_usdt') {
    return Number.parseFloat(value.replace(/\D/g, '')) || 0
  }

  return Number.parseFloat(value.replace(/,/g, '.')) || 0
}

function formatAssetAmount(amount: string, assetCode: 'USDT' | 'VND') {
  return assetCode === 'VND'
    ? `${formatVnd(amount)} VND`
    : `${formatUsdt(amount)} USDT`
}

export function ExchangeScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState('')
  const [direction, setDirection] = useState<ExchangeDirection>('vnd_to_usdt')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const walletsQuery = useQuery({
    queryKey: queryKeys.wallets,
    queryFn: walletApi.listWallets,
  })
  const financialSettingsQuery = useQuery({
    queryKey: queryKeys.financialSettings,
    queryFn: walletApi.getFinancialSettings,
    staleTime: 1000 * 60 * 5,
  })

  const rawAmount = useMemo(
    () => parseSourceAmount(amount, direction),
    [amount, direction],
  )
  const balanceCardUi = getExchangeBalanceCardUi(direction)

  const financialSettingsGate = getFinancialSettingsGate({
    context: 'exchange',
    isError: financialSettingsQuery.isError,
    isPending: financialSettingsQuery.isPending,
    settings: financialSettingsQuery.data,
  })

  const fromAssetCode = balanceCardUi.leftAssetCode
  const toAssetCode = balanceCardUi.rightAssetCode
  const exchangeFeeBps =
    direction === 'vnd_to_usdt'
      ? (financialSettingsQuery.data?.exchangeVndToUsdtFeeBps ?? null)
      : (financialSettingsQuery.data?.exchangeUsdtToVndFeeBps ?? null)

  const quoteQuery = useQuery({
    queryKey: ['exchange', 'quote', fromAssetCode, toAssetCode, rawAmount],
    queryFn: () =>
      exchangeApi.createQuote({
        amount: String(rawAmount),
        fromAssetCode,
        toAssetCode,
      }),
    enabled: rawAmount > 0 && financialSettingsGate.isReady,
    retry: false,
  })

  const executeMutation = useMutation({
    mutationFn: exchangeApi.execute,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.wallets }),
        queryClient.invalidateQueries({ queryKey: queryKeys.history }),
      ])
    },
  })

  const wallets = walletsQuery.data ?? []
  const vndWallet = findWalletByAssetCode(wallets, 'VND')
  const usdtWallet = findWalletByAssetCode(wallets, 'USDT')
  const sourceWallet = direction === 'vnd_to_usdt' ? vndWallet : usdtWallet
  const targetWallet = direction === 'vnd_to_usdt' ? usdtWallet : vndWallet
  const sourceBalance = Number.parseFloat(sourceWallet?.balances.available ?? '0')
  const maxExchangeableAmount =
    direction === 'vnd_to_usdt'
      ? Math.floor(sourceBalance)
      : Math.floor(sourceBalance * 100) / 100
  const fromAssetTone = getExchangeAssetTone(fromAssetCode)
  const toAssetTone = getExchangeAssetTone(toAssetCode)

  if (walletsQuery.isPending || financialSettingsQuery.isPending) {
    return <ScreenLoader />
  }

  const receivePreview = quoteQuery.data?.toAmount ?? '0'
  const feeHintAssetCode =
    (quoteQuery.data?.feeAssetCode as 'USDT' | 'VND' | undefined) ?? toAssetCode
  const feeHintAmount =
    quoteQuery.data?.feeAmount !== undefined
      ? formatAssetAmount(quoteQuery.data.feeAmount, feeHintAssetCode)
      : '--'
  const displayError =
    error ||
    (quoteQuery.isError ? translateApiError(quoteQuery.error, 'Lỗi đổi tiền.') : '')

  const handleAmountChange = (nextValue: string) => {
    setAmount(sanitizeExchangeInput(nextValue, direction))
    setError('')
    setSuccessMessage('')
  }

  const setMax = () => {
    setAmount(
      direction === 'vnd_to_usdt'
        ? (maxExchangeableAmount
            ? Number(maxExchangeableAmount).toLocaleString('vi-VN')
            : '')
        : (maxExchangeableAmount ? maxExchangeableAmount.toFixed(2) : ''),
    )
    setError('')
    setSuccessMessage('')
  }

  const toggleDirection = () => {
    setDirection((current) =>
      current === 'vnd_to_usdt' ? 'usdt_to_vnd' : 'vnd_to_usdt',
    )
    setAmount('')
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async () => {
    if (!rawAmount || rawAmount <= 0) {
      setError(
        direction === 'vnd_to_usdt'
          ? 'Vui lòng nhập số VND muốn đổi.'
          : 'Vui lòng nhập số USDT muốn đổi.',
      )
      return
    }

    setError('')

    try {
      const quote =
        quoteQuery.data ??
        (await exchangeApi.createQuote({
          amount: String(rawAmount),
          fromAssetCode,
          toAssetCode,
        }))

      if (!financialSettingsGate.isReady) {
        setError(financialSettingsGate.message)
        return
      }

      if (Number.parseFloat(quote.totalDebit) > sourceBalance) {
        setError(
          `Số dư ${fromAssetCode} không đủ để thanh toán ${formatAssetAmount(
            quote.totalDebit,
            fromAssetCode,
          )}.`,
        )
        return
      }

      await executeMutation.mutateAsync({
        quoteId: quote.id,
      })

      setSuccessMessage(
        `Đổi thành công! Nhận ${formatAssetAmount(
          quote.toAmount,
          toAssetCode,
        )}, tổng trừ ${formatAssetAmount(quote.totalDebit, fromAssetCode)}.`,
      )
      setAmount('')
    } catch (mutationError) {
      setError(translateApiError(mutationError, 'Lỗi đổi tiền.'))
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate({ to: '/dashboard' })}
          type="button"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className={styles.headerTitle}>Đổi tiền</div>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.balanceCard}>
        <div className={styles.balanceSwapRow}>
          <div className={styles.balanceItem}>
            <span
              className={`${styles.balanceTag} ${
                fromAssetTone === 'green' ? styles.balanceTagGreen : styles.balanceTagBlue
              }`}
            >
              {balanceCardUi.leftAssetCode}
            </span>
            <span className={styles.balanceNum}>
              {fromAssetCode === 'VND'
                ? formatVnd(sourceWallet?.balances.available ?? '0')
                : formatUsdt(sourceWallet?.balances.available ?? '0')}
            </span>
          </div>
          <button
            className={styles.balanceSwapBtn}
            onClick={toggleDirection}
            aria-label={`Đảo chiều ${fromAssetCode} sang ${toAssetCode}`}
            type="button"
          >
            <i className="fas fa-exchange-alt" aria-hidden="true"></i>
          </button>
          <div className={styles.balanceItem}>
            <span
              className={`${styles.balanceTag} ${
                toAssetTone === 'green' ? styles.balanceTagGreen : styles.balanceTagBlue
              }`}
            >
              {balanceCardUi.rightAssetCode}
            </span>
            <span className={styles.balanceNum}>
              {toAssetCode === 'VND'
                ? formatVnd(targetWallet?.balances.available ?? '0')
                : formatUsdt(targetWallet?.balances.available ?? '0')}
            </span>
          </div>
        </div>
        <div className={styles.balanceDirectionText}>
          <span className={styles.balanceDirectionAsset}>{fromAssetCode}</span>
          <span className={styles.balanceDirectionDivider} aria-hidden="true">
            <i className="fas fa-arrow-right"></i>
          </span>
          <span className={styles.balanceDirectionAsset}>{toAssetCode}</span>
        </div>
      </div>

      <div className={styles.formCard}>
        <div className={styles.fieldGroup}>
          <div className={styles.fieldHeader}>
            <label className={styles.label}>
              {direction === 'vnd_to_usdt' ? 'Số VND muốn đổi' : 'Số USDT muốn đổi'}
            </label>
            <div className={styles.feeHint}>
              Phí giao dịch {exchangeFeeBps !== null ? formatBpsPercent(exchangeFeeBps) : '--'}
              : {feeHintAmount}
            </div>
          </div>
          <div className={styles.inputWrap}>
            <span
              className={`${styles.inputPrefix} ${
                fromAssetTone === 'green' ? styles.inputPrefixGreen : styles.inputPrefixBlue
              }`}
            >
              {fromAssetCode === 'VND' ? '₫' : '₮'}
            </span>
            <input
              id="exchange-amount"
              type="text"
              inputMode={fromAssetCode === 'VND' ? 'numeric' : 'decimal'}
              className={styles.input}
              placeholder="0"
              value={amount}
              onChange={(event) => handleAmountChange(event.target.value)}
            />
            <button
              className={styles.maxBtn}
              disabled={!financialSettingsGate.isReady}
              onClick={setMax}
              type="button"
            >
              MAX
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            {toAssetCode === 'USDT' ? 'USDT bạn nhận được' : 'VND bạn nhận được'}
          </label>
          <div className={styles.inputWrap}>
            <span
              className={`${styles.inputPrefix} ${
                toAssetTone === 'green' ? styles.inputPrefixGreen : styles.inputPrefixBlue
              }`}
            >
              {toAssetCode === 'VND' ? '₫' : '₮'}
            </span>
            <div
              className={`${styles.usdtPreview} ${
                toAssetCode === 'VND' ? styles.previewVnd : ''
              }`}
            >
              {toAssetCode === 'VND'
                ? formatVnd(receivePreview)
                : formatUsdt(receivePreview)}
            </div>
          </div>
        </div>

        {!financialSettingsGate.isReady ? (
          <div className={styles.errorBox}>
            <i className="fas fa-exclamation-circle"></i>
            <span>{financialSettingsGate.message}</span>
          </div>
        ) : null}

        {displayError ? (
          <div className={styles.errorBox}>
            <i className="fas fa-exclamation-circle"></i>
            <span>{displayError}</span>
          </div>
        ) : null}

        {successMessage ? (
          <div className={styles.successBox}>
            <i className="fas fa-check-circle"></i>
            <span>{successMessage}</span>
          </div>
        ) : null}

        <button
          id="btn-confirm-exchange"
          className={styles.submitBtn}
          disabled={
            executeMutation.isPending ||
            !amount ||
            quoteQuery.isPending ||
            !financialSettingsGate.isReady
          }
          onClick={() => void handleSubmit()}
          type="button"
        >
          {executeMutation.isPending ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>&nbsp;Đang xử lý...
            </>
          ) : (
            <>
              <i className="fas fa-exchange-alt"></i>&nbsp;
              {direction === 'vnd_to_usdt'
                ? 'Xác nhận đổi VND sang USDT'
                : 'Xác nhận đổi USDT sang VND'}
            </>
          )}
        </button>

        <button
          className={styles.cancelBtn}
          onClick={() => navigate({ to: '/dashboard' })}
          type="button"
        >
          Quay lại
        </button>
      </div>
    </div>
  )
}
