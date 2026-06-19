import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { nitro } from 'nitro/vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const CLIENT_HOST = '0.0.0.0'
const CLIENT_PORT = 5173
const PREVIEW_PORT = 4173

const config = defineConfig({
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackStart(),
    nitro(),
    viteReact(),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  preview: {
    host: CLIENT_HOST,
    port: PREVIEW_PORT,
    strictPort: true,
  },
  server: {
    host: CLIENT_HOST,
    port: CLIENT_PORT,
    strictPort: true,
  },
})

export default config
