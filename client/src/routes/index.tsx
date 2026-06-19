import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { GuestOnly } from '#/features/auth/route-gates'
import { authApi, toSession } from '#/features/auth/api'
import { getLoginUiCopy } from '#/features/auth/ui'
import { useAuthSession } from '#/lib/auth/auth-context'
import { brandConfig } from '#/lib/config/branding'
import { queryKeys } from '#/lib/query-keys'

export const Route = createFileRoute('/')({
  component: LoginRoute,
})

function LoginRoute() {
  return (
    <GuestOnly>
      <LoginScreen />
    </GuestOnly>
  )
}

export function LoginScreen() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { setSession } = useAuthSession()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const loginUiCopy = getLoginUiCopy()

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onError: () => {
      setError('Email hoặc mật khẩu không đúng')
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
    },
    onSubmit: async ({ value }) => {
      if (!value.email.trim() || !value.password.trim()) {
        setError('Vui lòng nhập Email và Mật khẩu!')
        return
      }

      setError('')

      try {
        await loginMutation.mutateAsync({
          email: value.email.trim(),
          password: value.password,
        })
      } catch {
        // Error state is already handled by the mutation onError callback.
      }
    },
  })

  return (
    <div className="mobile-container">
      <div className="logo-container">
        <div className="logo-block">
          <img
            src={brandConfig.logoSrc}
            alt={brandConfig.loginLogoAlt}
            style={{
              animation: 'fadeIn 1s ease-in-out',
              height: '80px',
              objectFit: 'contain',
              width: 'auto',
            }}
          />
          <div className="login-branding">
            <div className="login-brand-title">TÀI KHOẢN TRUNG GIAN</div>
            <div className="login-brand-tagline">
              Thanh Toán Trực Tuyến - Ẩn Danh Người Dùng
            </div>
          </div>
        </div>
      </div>

      <div className="form-container">
        <form.Field name="email">
          {(field) => (
            <div className="input-group">
              <input
                type="text"
                placeholder={loginUiCopy.identifierPlaceholder}
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
            <div className="input-group">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Nhập mật khẩu"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  setError('')
                  field.handleChange(event.target.value)
                }}
              />
              <i
                className={`fas ${showPassword ? 'fa-eye' : 'fa-eye-slash'} toggle-password`}
                onClick={() => setShowPassword((value) => !value)}
              ></i>
            </div>
          )}
        </form.Field>

        <button
          className="btn-login"
          type="button"
          disabled={loginMutation.isPending}
          onClick={() => void form.handleSubmit()}
        >
          {loginMutation.isPending ? 'Đang xử lý...' : 'ĐĂNG NHẬP'}
        </button>
        <Link to="/forgot-password" className="forgot-password">
          Quên mật khẩu
        </Link>
        {error ? <p className="login-error-message">{error}</p> : null}
      </div>

      <div className="footer-container">
        <Link to="/register">
          <button className="btn-register" type="button">
            ĐĂNG KÝ TÀI KHOẢN
          </button>
        </Link>
      </div>
    </div>
  )
}
