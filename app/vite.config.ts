// Portions of this file were generated with AI assistance (Claude) and reviewed by the team.
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  // Relative base so the built site works from any folder or sub-path (Vercel, GitHub Pages, Netlify). It needs a web
  // server: opened as file://, browsers block module scripts and data files (index.html then says so).
  base: './',
  // The globe chunk (MapLibre + Terra Draw) is about 1.1 MB unminified; it loads after the first screen.
  build: { chunkSizeWarningLimit: 1400 },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts'],
  },
})
