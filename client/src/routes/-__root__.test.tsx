import { describe, expect, it } from 'vitest'
import type { ReactElement } from 'react'

import { RootDocument, Route } from './__root'

describe('root route', () => {
  it('sets the public app title to the new brand', async () => {
    const head = await Route.options.head?.({
      matches: [],
      match: undefined as never,
      params: {},
    })

    expect(head?.meta).toContainEqual({
      title: 'Tài khoản trung gian',
    })
  })

  it('declares the rebranded favicon and manifest assets', async () => {
    const head = await Route.options.head?.({
      matches: [],
      match: undefined as never,
      params: {},
    })

    expect(head?.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          href: '/favicon.ico',
          rel: 'icon',
        }),
        expect.objectContaining({
          href: '/manifest.json',
          rel: 'manifest',
        }),
      ]),
    )
  })

  it('configures a not found component at the root level', () => {
    expect(Route.options.notFoundComponent).toBeTypeOf('function')
  })

  it('suppresses hydration warnings on the body element', () => {
    const document = RootDocument({ children: null }) as ReactElement<{
      children: [ReactElement, ReactElement<{ suppressHydrationWarning?: boolean }>]
    }>
    const body = document.props.children[1]

    expect(body.type).toBe('body')
    expect(body.props.suppressHydrationWarning).toBe(true)
  })
})
