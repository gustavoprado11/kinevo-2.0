import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: ['lib/**/*.test.ts', 'utils/**/*.test.ts'],
        exclude: ['node_modules'],
    },
    resolve: {
        alias: {
            '@kinevo/shared': path.resolve(__dirname, '.'),
        },
    },
})
