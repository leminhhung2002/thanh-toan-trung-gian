import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('admin route', () => {
  it('uses the adminxxx path for the client admin shell', () => {
    const routeTreeSource = readFileSync(
      resolve(import.meta.dirname, '../routeTree.gen.ts'),
      'utf8',
    )

    expect(routeTreeSource).toContain("'/adminxxx'")
    expect(routeTreeSource).not.toContain("'/admin'")
  })
})
