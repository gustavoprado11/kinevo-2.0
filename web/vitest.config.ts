/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.tsx'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: [
      'node_modules',
      'src/lib/prescription/__tests__/**', // legacy manual test runners
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/components/dashboard/**',
        'src/stores/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@kinevo/shared': path.resolve(__dirname, '../shared'),
      // Test-only: `server-only`/`client-only` fail a bundle boundary at BUILD
      // time; vitest has no such boundary, so alias them to a no-op stub. This
      // affects ONLY the test runner — never the Next build/runtime, where the
      // guards must (and do) still trip a real client-bundle leak.
      'server-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
      'client-only': path.resolve(__dirname, './src/test/server-only-stub.ts'),
    },
  },
})
