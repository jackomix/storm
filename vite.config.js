import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),
    VitePWA({ registerType: 'autoUpdate' })
  ],
  server: {
    host: true
  },
  base: '/storm/',
  define: {
        '__APP_VERSION__': JSON.stringify(new Date().toISOString()),
  }
})