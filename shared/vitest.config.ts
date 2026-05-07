import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
        include: [
            'lib/**/*.test.ts',
            'utils/**/*.test.ts',
            'constants/**/*.test.ts',
        ],
        exclude: ['node_modules'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary'],
            include: [
                'lib/assessment-protocols/**/*.ts',
            ],
            exclude: [
                'lib/assessment-protocols/**/__tests__/**',
                'lib/assessment-protocols/index.ts',
                'lib/assessment-protocols/types.ts',
                'lib/assessment-protocols/protocols.ts',
            ],
            thresholds: {
                lines: 95,
                statements: 95,
                functions: 95,
                branches: 95,
            },
        },
    },
    resolve: {
        alias: {
            '@kinevo/shared': path.resolve(__dirname, '.'),
        },
    },
})
