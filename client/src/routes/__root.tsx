import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import TanstackQueryProvider from '../integrations/tanstack-query/root-provider'
import { AuthBootstrap } from '../features/auth/auth-bootstrap'
import { AuthSessionProvider } from '../lib/auth/auth-context'
import { brandConfig } from '../lib/config/branding'

import appCss from '../styles.css?url'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: brandConfig.appName,
      },
    ],
    links: [
      {
        rel: 'icon',
        href: '/favicon.ico',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  notFoundComponent: NotFoundScreen,
  shellComponent: RootDocument,
  component: RootComponent,
})

export function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body suppressHydrationWarning>
        <div id="app-root">{children}</div>
        <Scripts />
      </body>
    </html>
  )
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext()

  return (
    <TanstackQueryProvider queryClient={queryClient}>
      <AuthSessionProvider>
        <AuthBootstrap />
        <div className="app-shell">
          <Outlet />
        </div>
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
            TanStackQueryDevtools,
          ]}
        />
      </AuthSessionProvider>
    </TanstackQueryProvider>
  )
}

function NotFoundScreen() {
  return (
    <div className="app-shell">
      <div
        style={{
          alignItems: 'center',
          color: '#1a1a2e',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ color: '#f26622', fontSize: '18px', fontWeight: 700 }}>
          Không tìm thấy trang
        </div>
        <div style={{ fontSize: '14px', maxWidth: '320px' }}>
          Đường dẫn bạn mở không tồn tại trong hệ thống.
        </div>
      </div>
    </div>
  )
}
