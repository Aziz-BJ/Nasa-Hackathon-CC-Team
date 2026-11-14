// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works from any folder (GitHub Pages, Netlify, a USB stick).
  base: './',
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
