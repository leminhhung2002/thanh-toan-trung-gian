import { useEffect, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { BottomNav } from '#/components/bottom-nav'
import { NotificationHistoryOverlay } from '#/features/history/notification-overlay'
import { NotificationBellButton } from '#/features/notifications/notification-bell-button'
import { ScreenLoader } from '#/components/screen-loader'
import { accountApi } from '#/features/account/api'
import { getSensitiveFieldDisplayValue } from '#/features/account/privacy'
import { authApi } from '#/features/auth/api'
import { RequireUser } from '#/features/auth/route-gates'
import { translateApiError } from '#/lib/api/error-copy'
import { useAuthSession } from '#/lib/auth/auth-context'
import { queryKeys } from '#/lib/query-keys'
import styles from './account.module.css'

export const Route = createFileRoute('/account')({
  component: AccountRoute,
})

function AccountRoute() {
  return (
    <RequireUser>
      <AccountScreen />
    </RequireUser>
  )
}

export function AccountScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { clearSession, session } = useAuthSession()
  const [saved, setSaved] = useState({ phone: false, telegram: false })
  const [showNotifications, setShowNotifications] = useState(false)
  const [editing, setEditing] = useState({ phone: '', telegram: '' })
  const [editingField, setEditingField] = useState<'phone' | 'telegram' | null>(
    null,
  )
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')

  const profileQuery = useQuery({
    queryKey: queryKeys.profile,
    queryFn: accountApi.getProfile,
  })

  const saveMutation = useMutation({
    mutationFn: async (input: {
      currentPassword?: string
      field: 'phone' | 'telegram'
      values: {
        phone: string
        telegram: string
      }
    }) =>
      accountApi.updateProfile({
        currentPassword: input.currentPassword,
        phone: input.values.phone,
        telegram: input.values.telegram,
      }),
    onError: (mutationError) => {
      setError(translateApiError(mutationError, 'Lỗi cập nhật'))
    },
    onSuccess: (profile, variables) => {
      queryClient.setQueryData(queryKeys.profile, profile)
      if (variables.field === 'phone') {
        setSaved((current) => ({ ...current, phone: true }))
        window.setTimeout(
          () => setSaved((current) => ({ ...current, phone: false })),
          2000,
        )
      }
      if (variables.field === 'telegram') {
        setSaved((current) => ({ ...current, telegram: true }))
        window.setTimeout(
          () => setSaved((current) => ({ ...current, telegram: false })),
          2000,
        )
      }
    },
  })

  const profile = profileQuery.data

  useEffect(() => {
    if (!profile) {
      return
    }

    setEditing({
      phone: profile.phone ?? '',
      telegram: profile.telegram ?? '',
    })
  }, [profile])

  if (profileQuery.isPending) {
    return <ScreenLoader />
  }

  if (!profile) {
    return <ScreenLoader message="Không thể tải thông tin tài khoản." />
  }

  const saveField = async (field: 'phone' | 'telegram') => {
    if (!currentPassword.trim()) {
      setError('Vui lòng nhập mật khẩu hiện tại để xác nhận thay đổi.')
      return
    }

    setError('')
    await saveMutation.mutateAsync({
      currentPassword: currentPassword.trim(),
      field,
      values: editing,
    })
    setEditingField(null)
    setCurrentPassword('')
  }

  const openSensitiveEdit = (field: 'phone' | 'telegram') => {
    setError('')
    setEditing({
      phone: field === 'phone' ? '' : (profile.phone ?? ''),
      telegram: field === 'telegram' ? '' : (profile.telegram ?? ''),
    })
    setEditingField(field)
    setCurrentPassword('')
  }

  const cancelSensitiveEdit = () => {
    setEditing({
      phone: profile.phone ?? '',
      telegram: profile.telegram ?? '',
    })
    setEditingField(null)
    setCurrentPassword('')
    setError('')
  }

  const logout = async () => {
    try {
      if (session?.refreshToken) {
        await authApi.logout(session.refreshToken)
      }
    } catch {}

    clearSession()
    queryClient.clear()
    await navigate({ to: '/' })
  }

  return (
    <div className={styles.container}>
      <div className={styles.headerBox}>
        <div className={styles.headerTop}>
          <div className={styles.headerTitle}>Thông tin tài khoản</div>
          <NotificationBellButton
            ariaLabel="Mở thông báo"
            buttonClassName={styles.mailButton}
            iconClassName={styles.mailIcon}
            onClick={() => setShowNotifications(true)}
          />
        </div>
      </div>

      <div className={styles.infoCard}>
        <SensitiveInfoRow
          label="Email"
          value={getSensitiveFieldDisplayValue({
            kind: 'email',
            value: profile.email,
          })}
        />

        <SensitiveInfoRow
          actions={[
            {
              label: 'Thay đổi',
              onClick: () => openSensitiveEdit('phone'),
              tone: 'primary',
            },
          ]}
          label="Số điện thoại"
          value={getSensitiveFieldDisplayValue({
            kind: 'phone',
            value: profile.phone,
          })}
        >
          {editingField === 'phone' ? (
            <SensitiveEditBlock
              busy={saveMutation.isPending}
              currentPasswordValue={currentPassword}
              inputId="input-phone"
              inputType="tel"
              label="Số điện thoại mới"
              onCancel={cancelSensitiveEdit}
              onCurrentPasswordChange={(value) => {
                setError('')
                setCurrentPassword(value)
              }}
              onInputChange={(value) => {
                setError('')
                setEditing((current) => ({ ...current, phone: value }))
              }}
              onSave={() => void saveField('phone')}
              placeholder="Nhập số điện thoại"
              saved={saved.phone}
              value={editing.phone}
            />
          ) : null}
        </SensitiveInfoRow>

        <SensitiveInfoRow
          actions={[
            {
              label: 'Thay đổi',
              onClick: () => openSensitiveEdit('telegram'),
              tone: 'primary',
            },
          ]}
          label="Telegram"
          value={getSensitiveFieldDisplayValue({
            kind: 'telegram',
            value: profile.telegram,
          })}
        >
          {editingField === 'telegram' ? (
            <SensitiveEditBlock
              busy={saveMutation.isPending}
              currentPasswordValue={currentPassword}
              inputId="input-telegram"
              inputType="text"
              label="Username Telegram mới (không nhập link)"
              onCancel={cancelSensitiveEdit}
              onCurrentPasswordChange={(value) => {
                setError('')
                setCurrentPassword(value)
              }}
              onInputChange={(value) => {
                setError('')
                setEditing((current) => ({ ...current, telegram: value }))
              }}
              onSave={() => void saveField('telegram')}
              placeholder="Nhập username Telegram"
              saved={saved.telegram}
              value={editing.telegram}
            />
          ) : null}
        </SensitiveInfoRow>

        {error ? <div className={styles.errorMsg}>{error}</div> : null}
      </div>

      <div className={styles.actionBottom}>
        <div className={styles.btnWhite} onClick={() => navigate({ to: '/change-password' })}>
          Đổi mật khẩu
        </div>
        <div className={styles.btnWhite} onClick={() => void logout()}>
          Đăng xuất
        </div>
      </div>

      <NotificationHistoryOverlay
        onClose={() => setShowNotifications(false)}
        open={showNotifications}
      />

      <BottomNav active="account" />
    </div>
  )
}

function SensitiveInfoRow(props: {
  actions?: Array<{
    label: string
    onClick: () => void
    tone: 'primary' | 'secondary'
  }>
  children?: ReactNode
  label: string
  value: string
}) {
  const actions = props.actions ?? []

  return (
    <div className={styles.sensitiveRow}>
      <div className={styles.sensitiveHeader}>
        <span className={styles.label}>{props.label}</span>
        {actions.length > 0 ? (
          <div className={styles.sensitiveActions}>
            {actions.map((action) => (
              <button
                key={action.label}
                className={
                  action.tone === 'primary'
                    ? styles.sensitiveActionPrimary
                    : styles.sensitiveActionSecondary
                }
                onClick={action.onClick}
                type="button"
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className={styles.sensitiveValue}>{props.value}</div>
      {props.children}
    </div>
  )
}

function SensitiveEditBlock(props: {
  busy: boolean
  currentPasswordValue: string
  inputId: string
  inputType: 'tel' | 'text'
  label: string
  onCancel: () => void
  onCurrentPasswordChange: (value: string) => void
  onInputChange: (value: string) => void
  onSave: () => void
  placeholder: string
  saved: boolean
  value: string
}) {
  return (
    <div className={styles.sensitiveEditBox}>
      <div className={styles.inputGroup}>
        <span className={styles.label}>{props.label}</span>
        <input
          id={props.inputId}
          type={props.inputType}
          className={`${styles.inputField} ${props.saved ? styles.inputSaved : ''}`}
          value={props.value}
          onChange={(event) => props.onInputChange(event.target.value)}
          placeholder={props.placeholder}
        />
      </div>

      <div className={styles.inputGroup}>
        <span className={styles.label}>Mật khẩu hiện tại</span>
        <input
          type="password"
          className={styles.inputField}
          value={props.currentPasswordValue}
          onChange={(event) => props.onCurrentPasswordChange(event.target.value)}
          placeholder="Nhập mật khẩu hiện tại"
        />
      </div>

      <div className={styles.sensitiveEditActions}>
        <button
          className={styles.sensitiveCancelBtn}
          disabled={props.busy}
          onClick={props.onCancel}
          type="button"
        >
          Hủy
        </button>
        <button
          className={`${styles.saveBtn} ${props.saved ? styles.saveBtnSuccess : ''}`}
          onClick={props.onSave}
          disabled={props.busy}
          type="button"
        >
          {props.busy ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : props.saved ? (
            <i className="fas fa-check"></i>
          ) : (
            <i className="fas fa-lock"></i>
          )}
          <span>{props.saved ? 'OK' : 'Lưu'}</span>
        </button>
      </div>
    </div>
  )
}
