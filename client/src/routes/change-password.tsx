import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ScreenLoader } from '#/components/screen-loader'
import { accountApi } from '#/features/account/api'
import { RequireUser } from '#/features/auth/route-gates'
import { translateApiError } from '#/lib/api/error-copy'
import styles from './change-password.module.css'

export const Route = createFileRoute('/change-password')({
  component: ChangePasswordRoute,
})

function ChangePasswordRoute() {
  return (
    <RequireUser>
      <ChangePasswordScreen />
    </RequireUser>
  )
}

function ChangePasswordScreen() {
  const navigate = useNavigate()
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const changePasswordMutation = useMutation({
    mutationFn: accountApi.changePassword,
    onError: (mutationError) => {
      setError(translateApiError(mutationError, 'Đổi mật khẩu thất bại.'))
    },
    onSuccess: () => {
      setSuccess(true)
      window.setTimeout(() => {
        void navigate({ to: '/account' })
      }, 2000)
    },
  })

  const form = useForm({
    defaultValues: {
      confirmPassword: '',
      currentPassword: '',
      newPassword: '',
    },
    onSubmit: async ({ value }) => {
      if (!value.currentPassword || !value.newPassword || !value.confirmPassword) {
        setError('Vui lòng điền đầy đủ tất cả các trường.')
        return
      }

      if (value.newPassword.length < 8) {
        setError('Mật khẩu mới phải có ít nhất 8 ký tự.')
        return
      }

      if (value.newPassword !== value.confirmPassword) {
        setError('Mật khẩu xác nhận không khớp.')
        return
      }

      setError('')

      await changePasswordMutation.mutateAsync({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
      })
    },
  })

  if (changePasswordMutation.isPending && success) {
    return <ScreenLoader />
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button
          className={styles.backBtn}
          onClick={() => navigate({ to: '/account' })}
          type="button"
        >
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className={styles.headerTitle}>Đổi mật khẩu</div>
        <div className={styles.headerRight}></div>
      </div>

      <div className={styles.iconSection}>
        <div className={styles.lockCircle}>
          <i className="fas fa-lock"></i>
        </div>
        <p className={styles.iconDesc}>
          Nhập mật khẩu hiện tại và mật khẩu mới để cập nhật bảo mật tài khoản
        </p>
      </div>

      <div className={styles.formCard}>
        {success ? (
          <div className={styles.successBox}>
            <i className="fas fa-check-circle"></i>
            <p>Đổi mật khẩu thành công!</p>
            <span>Đang chuyển về trang tài khoản...</span>
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void form.handleSubmit()
            }}
          >
            <form.Field name="currentPassword">
              {(field) => (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Mật khẩu hiện tại</label>
                  <div className={styles.inputWrap}>
                    <i className={`fas fa-lock ${styles.inputIcon}`}></i>
                    <input
                      id="current-password"
                      type={showCurrent ? 'text' : 'password'}
                      name="currentPassword"
                      className={styles.input}
                      placeholder="Nhập mật khẩu hiện tại"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setError('')
                        field.handleChange(event.target.value)
                      }}
                    />
                    <button
                      className={styles.eyeBtn}
                      onClick={() => setShowCurrent((value) => !value)}
                      type="button"
                    >
                      <i className={`fas ${showCurrent ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="newPassword">
              {(field) => (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Mật khẩu mới</label>
                  <div className={styles.inputWrap}>
                    <i className={`fas fa-key ${styles.inputIcon}`}></i>
                    <input
                      id="new-password"
                      type={showNew ? 'text' : 'password'}
                      name="newPassword"
                      className={styles.input}
                      placeholder="Nhập mật khẩu mới (tối thiểu 8 ký tự)"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setError('')
                        field.handleChange(event.target.value)
                      }}
                    />
                    <button
                      className={styles.eyeBtn}
                      onClick={() => setShowNew((value) => !value)}
                      type="button"
                    >
                      <i className={`fas ${showNew ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              )}
            </form.Field>

            <form.Field name="confirmPassword">
              {(field) => (
                <div className={styles.fieldGroup}>
                  <label className={styles.label}>Xác nhận mật khẩu mới</label>
                  <div className={styles.inputWrap}>
                    <i className={`fas fa-shield-alt ${styles.inputIcon}`}></i>
                    <input
                      id="confirm-password"
                      type={showConfirm ? 'text' : 'password'}
                      name="confirmPassword"
                      className={styles.input}
                      placeholder="Nhập lại mật khẩu mới"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(event) => {
                        setError('')
                        field.handleChange(event.target.value)
                      }}
                    />
                    <button
                      className={styles.eyeBtn}
                      onClick={() => setShowConfirm((value) => !value)}
                      type="button"
                    >
                      <i className={`fas ${showConfirm ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                    </button>
                  </div>
                </div>
              )}
            </form.Field>

            {error ? (
              <div className={styles.errorBox}>
                <i className="fas fa-exclamation-circle"></i>
                <span>{error}</span>
              </div>
            ) : null}

            <button
              id="submit-change-password"
              className={styles.submitBtn}
              disabled={changePasswordMutation.isPending}
              type="submit"
            >
              {changePasswordMutation.isPending ? (
                <>
                  <i className="fas fa-spinner fa-spin"></i>
                  &nbsp;Đang xử lý...
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i>
                  &nbsp;Xác nhận đổi mật khẩu
                </>
              )}
            </button>

            <button
              className={styles.cancelBtn}
              onClick={() => navigate({ to: '/account' })}
              type="button"
            >
              Huỷ bỏ
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
