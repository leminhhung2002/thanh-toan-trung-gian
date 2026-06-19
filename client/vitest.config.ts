import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

const srcDir = fileURLToPath(new URL('./src/', import.meta.url))
const stubsDir = fileURLToPath(new URL('./test-stubs/', import.meta.url))

export default defineConfig({
  plugins: [viteReact()],
  resolve: {
    alias: [
      {
        find: /^#\//,
        replacement: `${srcDir}`,
      },
      {
        find: '@tanstack/react-devtools',
        replacement: `${stubsDir}tanstack-react-devtools.tsx`,
      },
      {
        find: '@tanstack/react-router-devtools',
        replacement: `${stubsDir}tanstack-react-router-devtools.tsx`,
      },
      {
        find: '@tanstack/react-query-devtools',
        replacement: `${stubsDir}tanstack-react-query-devtools.tsx`,
      },
    ],
    tsconfigPaths: true,
  },
  test: {
    passWithNoTests: false,
  },
})
