import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const clientRoot = path.resolve(import.meta.dirname, '../..')

function readClientFile(relativePath: string) {
  return readFileSync(path.join(clientRoot, relativePath), 'utf8')
}

describe('user-facing desktop shell layout', () => {
  it('defines a shared desktop width token for user shells', () => {
    const appStyles = readClientFile('styles.css')

    expect(appStyles).toContain('--user-shell-max-width: 400px;')
    expect(appStyles).toContain('@media screen and (min-width: 768px)')
    expect(appStyles).toContain(
      '--user-shell-max-width: clamp(400px, 33vw, 560px);',
    )
  })

  it('reuses the shared width token across guest auth shells', () => {
    const appStyles = readClientFile('styles.css')
    expect(appStyles).toContain('max-width: var(--user-shell-max-width);')

    const authFiles = [
      'routes/register.module.css',
      'routes/forgot-password.module.css',
    ] as const

    for (const relativePath of authFiles) {
      const css = readClientFile(relativePath)

      expect(
        css,
        `${relativePath} should use the shared user shell width token`,
      ).toContain('max-width: var(--user-shell-max-width);')
    }
  })

  it('reuses the shared width token across user-facing screens and panels', () => {
    const filesWithExpectedOccurrences = [
      ['routes/dashboard.module.css', 2],
      ['routes/history.module.css', 1],
      ['routes/account.module.css', 1],
      ['routes/exchange.module.css', 1],
      ['routes/change-password.module.css', 1],
      ['components/bottom-nav.module.css', 1],
      ['features/history/notification-overlay.module.css', 1],
    ] as const

    for (const [relativePath, expectedOccurrences] of filesWithExpectedOccurrences) {
      const css = readClientFile(relativePath)
      const matches = css.match(/var\(--user-shell-max-width\)/g) ?? []

      expect(
        matches,
        `${relativePath} should use the shared user shell width token`,
      ).toHaveLength(expectedOccurrences)
    }
  })
})
