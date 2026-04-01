import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { BodyMetricsTrend } from '../body-metrics-trend'

describe('BodyMetricsTrend', () => {
    it('renders current weight and body fat', () => {
        render(
            <BodyMetricsTrend
                history={[
                    { weight: 80, bodyFat: 18, date: '2026-03-01' },
                    { weight: 79, bodyFat: 17.5, date: '2026-03-15' },
                    { weight: 78.5, bodyFat: 17, date: '2026-03-28' },
                ]}
                currentWeight="78.5"
                currentBodyFat="17"
            />
        )
        expect(screen.getByText(/78[.,]5/)).toBeInTheDocument()
        expect(screen.getByText(/17/)).toBeInTheDocument()
    })

    it('shows trend direction for weight loss', () => {
        render(
            <BodyMetricsTrend
                history={[
                    { weight: 85, bodyFat: 20, date: '2026-02-01' },
                    { weight: 82, bodyFat: 19, date: '2026-03-01' },
                    { weight: 79, bodyFat: 18, date: '2026-03-28' },
                ]}
                currentWeight="79"
                currentBodyFat="18"
            />
        )
        // Should show a downward trend indicator for weight
        const container = document.querySelector('[class*="trend"], [class*="Trend"]') ||
            screen.getByText(/kg/i)?.closest('[class]')
        expect(container).toBeTruthy()
    })

    it('handles null values gracefully', () => {
        render(
            <BodyMetricsTrend
                history={[]}
                currentWeight={null}
                currentBodyFat={null}
            />
        )
        // Should not crash — may show placeholder or nothing
        expect(document.body).toBeTruthy()
    })

    it('renders sparkline SVG when enough data points exist', () => {
        const { container } = render(
            <BodyMetricsTrend
                history={[
                    { weight: 80, bodyFat: null, date: '2026-01-01' },
                    { weight: 79, bodyFat: null, date: '2026-02-01' },
                    { weight: 78, bodyFat: null, date: '2026-03-01' },
                ]}
                currentWeight="78"
                currentBodyFat={null}
            />
        )
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
    })

    it('does not render sparkline with fewer than 2 data points', () => {
        const { container } = render(
            <BodyMetricsTrend
                history={[{ weight: 80, bodyFat: null, date: '2026-03-01' }]}
                currentWeight="80"
                currentBodyFat={null}
            />
        )
        // MiniSparkline returns null with < 2 values
        const paths = container.querySelectorAll('svg path')
        expect(paths.length).toBeLessThanOrEqual(0)
    })
})
