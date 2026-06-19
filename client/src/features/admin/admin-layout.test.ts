import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const clientRoot = path.resolve(import.meta.dirname, '../..')

function readClientFile(relativePath: string) {
  return readFileSync(path.join(clientRoot, relativePath), 'utf8')
}

describe('admin review layout', () => {
  it('keeps review grid items at their intrinsic height instead of stretching to match QR cards', () => {
    const css = readClientFile('routes/admin.module.css')

    expect(css).toContain('.reviewGrid {')
    expect(css).toContain('align-items: start;')
  })

  it('adds a mobile sidebar toggle contract for the admin shell', () => {
    const adminPage = readClientFile('features/admin/admin-page.tsx')
    const css = readClientFile('routes/admin.module.css')

    expect(adminPage).toContain('mobileMenuBtn')
    expect(adminPage).toContain('isMobileSidebarOpen')
    expect(adminPage).toContain('handleSelectTab')
    expect(adminPage).toContain('setIsMobileSidebarOpen(false)')

    expect(css).toContain('.mobileMenuBtn')
    expect(css).toContain('.sidebarMobileOpen')
  })
})
