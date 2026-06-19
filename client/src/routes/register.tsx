import { useState } from 'react'
import { useForm, useStore } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { GuestOnly } from '#/features/auth/route-gates'
import { authApi, toSession } from '#/features/auth/api'
import { translateApiError } from '#/lib/api/error-copy'
import { useAuthSession } from '#/lib/auth/auth-context'
import { brandConfig } from '#/lib/config/branding'
import { queryKeys } from '#/lib/query-keys'
import styles from './register.module.css'

export const Route = createFileRoute('/register')({
  component: RegisterRoute,
})

function RegisterRoute() {
  return (
    <GuestOnly>
      <RegisterScreen />
    </GuestOnly>
  )
}

export function RegisterScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setSession } = useAuthSession()
  const [error, setError] = useState('')

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onError: (mutationError) => {
      setError(translateApiError(mutationError, 'Lỗi đăng ký'))
    },
    onSuccess: async (result) => {
      const baseSession = toSession(result)
      setSession(baseSession)
      queryClient.setQueryData(queryKeys.wallets, result.wallets)

      try {
        const me = await authApi.me()
        queryClient.setQueryData(queryKeys.authMe, me)
        queryClient.setQueryData(queryKeys.profile, me)
        setSession({
          ...baseSession,
          user: {
            email: me.email,
            id: me.id,
            roles: me.roles,
          },
        })
      } catch {
        queryClient.removeQueries({ queryKey: queryKeys.authMe })
      }

      await navigate({ to: '/dashboard' })
    },
  })

  const form = useForm({
    defaultValues: {
      email: '',
      password: '',
      phone: '',
      telegram: '',
    },
    onSubmit: async ({ value }) => {
      const nextEmail = value.email.trim()
      const nextPassword = value.password.trim()
      const nextPhone = value.phone.trim()
      const nextTelegram = value.telegram.trim()

      if (!nextEmail || !nextPassword || !nextPhone) {
        setError('Vui lòng nhập đầy đủ thông tin.')
        return
      }

      if (nextPassword.length < 8) {
        setError('Mật khẩu phải có ít nhất 8 ký tự.')
        return
      }

      setError('')

      await registerMutation.mutateAsync({
        email: nextEmail,
        password: nextPassword,
        phone: nextPhone,
        telegram: nextTelegram || undefined,
      })
    },
  })

  const values = useStore(form.store, (state) => state.values)
  const isFormFilled =
    values.email.trim() !== '' &&
    values.password.trim() !== '' &&
    values.phone.trim() !== ''

  return (
    <div className={styles.container}>
      <div className={styles.wrapper}>
        <div className={styles.logoContainer}>
          <div className={styles.logoImage}>
            <img
              src={brandConfig.logoSrc}
              alt={brandConfig.loginLogoAlt}
              style={{ height: '38px', objectFit: 'contain', width: 'auto' }}
            />
            <div className={styles.logoTextWrapper}>
              <span className={styles.logoTextMain}>{brandConfig.appName}</span>
            </div>
          </div>
          <span className={styles.logoTextSub}>{brandConfig.registerTagline}</span>
        </div>

        <h1 className={styles.title}>ĐĂNG KÝ TÀI KHOẢN CÁ NHÂN</h1>

        <div className={styles.form}>
          <form.Field name="email">
            {(field) => (
              <div className={styles.inputGroup}>
                <label className={styles.label}>EMAIL ĐĂNG NHẬP</label>
                <input
                  type="email"
                  className={styles.input}
                  placeholder="Nhập"
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
              <div className={styles.inputGroup}>
                <label className={styles.label}>MẬT KHẨU</label>
                <input
                  type="password"
                  className={styles.input}
                  placeholder="Nhập"
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

          <form.Field name="phone">
            {(field) => (
              <div className={styles.inputGroup}>
                <label className={styles.label}>SỐ ĐIỆN THOẠI</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Nhập"
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

          <form.Field name="telegram">
            {(field) => (
              <div className={styles.inputGroup}>
                <label className={styles.label}>USERNAME TELEGRAM</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Username Telegram"
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
        </div>

        <div className={styles.actions}>
          {error ? (
            <p
              style={{
                color: 'red',
                fontSize: '14px',
                marginBottom: '10px',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {error}
            </p>
          ) : null}
          <Link to="/">
            <button className={styles.btnBack} type="button">
              Quay lại
            </button>
          </Link>
          <button
            className={`${styles.btnContinue} ${isFormFilled ? styles.btnContinueActive : ''}`}
            disabled={!isFormFilled || registerMutation.isPending}
            onClick={() => void form.handleSubmit()}
            type="button"
          >
            {registerMutation.isPending ? 'Đang xử lý...' : 'Tiếp tục'}
          </button>
        </div>
      </div>
    </div>
  )
}
