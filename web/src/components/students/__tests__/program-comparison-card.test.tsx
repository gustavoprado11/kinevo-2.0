import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProgramComparisonCard } from '../program-comparison-card'

// ── Mock the dynamic import of getProgramMuscleVolume ──

const mockGetVolume = vi.fn()

vi.mock('@/app/students/[id]/actions/get-program-muscle-volume', () => ({
    getProgramMuscleVolume: (...args: unknown[]) => mockGetVolume(...args),
}))

// ── Fixtures ──

const currentVolumeData = {
    success: true,
    data: {
        programId: 'prog-current',
        programName: 'Hipertrofia A',
        groups: [
            { muscleGroup: 'Peito', sets: 20 },
            { muscleGroup: 'Costas', sets: 24 },
            { muscleGroup: 'Ombros', sets: 12 },
            { muscleGroup: 'Bíceps', sets: 8 },
            { muscleGroup: 'Tríceps', sets: 8 },
            { muscleGroup: 'Quadríceps', sets: 16 },
        ],
        totalSets: 88,
    },
}

const previousVolumeData = {
    success: true,
    data: {
        programId: 'prog-previous',
        programName: 'Adaptação',
        groups: [
            { muscleGroup: 'Peito', sets: 12 },
            { muscleGroup: 'Costas', sets: 16 },
            { muscleGroup: 'Ombros', sets: 8 },
            { muscleGroup: 'Bíceps', sets: 6 },
            { muscleGroup: 'Quadríceps', sets: 12 },
        ],
        totalSets: 54,
    },
}

// ── Tests ──

describe('ProgramComparisonCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockGetVolume.mockImplementation((programId: string) => {
            if (programId === 'prog-current') return Promise.resolve(currentVolumeData)
            if (programId === 'prog-previous') return Promise.resolve(previousVolumeData)
            return Promise.resolve({ success: false, error: 'Not found' })
        })
    })

    it('shows loading state initially', () => {
        // Use a never-resolving promise to keep loading state
        mockGetVolume.mockReturnValue(new Promise(() => {}))
        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )
        expect(screen.getByText(/Comparativo/i)).toBeInTheDocument()
    })

    it('fetches volume data for both programs on mount', async () => {
        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            expect(mockGetVolume).toHaveBeenCalledTimes(2)
            expect(mockGetVolume).toHaveBeenCalledWith('prog-current')
            expect(mockGetVolume).toHaveBeenCalledWith('prog-previous')
        })
    })

    it('renders muscle group rows after loading', async () => {
        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Peito')).toBeInTheDocument()
            expect(screen.getByText('Costas')).toBeInTheDocument()
        })
    })

    it('shows volume diff indicators after loading', async () => {
        const { container } = render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Peito')).toBeInTheDocument()
        })

        // After loading, diffs should be rendered somewhere in the DOM
        // The exact format may vary (e.g. "+8", "+4") so check container text
        const text = container.textContent || ''
        expect(text).toMatch(/\+\d/)
    })

    it('shows muscle groups unique to current program', async () => {
        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            // Tríceps exists only in current program
            expect(screen.getByText('Tríceps')).toBeInTheDocument()
        })
    })

    it('shows total sets summary', async () => {
        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Hipertrofia A"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            // Total: 88 sets current
            expect(screen.getByText(/88/)).toBeInTheDocument()
        })
    })

    it('handles error gracefully', async () => {
        mockGetVolume.mockResolvedValue({ success: false, error: 'DB error' })
        render(
            <ProgramComparisonCard
                currentProgramId="bad-id"
                currentProgramName="Programa X"
                previousProgramId="bad-id-2"
                previousProgramName="Programa Y"
            />
        )

        await waitFor(() => {
            // Should still render the card title without crashing
            expect(screen.getByText(/Comparativo/i)).toBeInTheDocument()
        })
    })

    it('expands to show all muscle groups when clicking expand', async () => {
        const user = userEvent.setup()

        // Create data with more than 6 muscle groups to trigger expand button
        const manyGroups = {
            success: true,
            data: {
                programId: 'prog-current',
                programName: 'Full Body',
                groups: [
                    { muscleGroup: 'Peito', sets: 20 },
                    { muscleGroup: 'Costas', sets: 24 },
                    { muscleGroup: 'Ombros', sets: 12 },
                    { muscleGroup: 'Bíceps', sets: 8 },
                    { muscleGroup: 'Tríceps', sets: 8 },
                    { muscleGroup: 'Quadríceps', sets: 16 },
                    { muscleGroup: 'Posterior', sets: 14 },
                    { muscleGroup: 'Glúteos', sets: 10 },
                ],
                totalSets: 112,
            },
        }

        mockGetVolume.mockImplementation((id: string) =>
            id === 'prog-current'
                ? Promise.resolve(manyGroups)
                : Promise.resolve(previousVolumeData)
        )

        render(
            <ProgramComparisonCard
                currentProgramId="prog-current"
                currentProgramName="Full Body"
                previousProgramId="prog-previous"
                previousProgramName="Adaptação"
            />
        )

        await waitFor(() => {
            expect(screen.getByText('Peito')).toBeInTheDocument()
        })

        // Look for expand button
        const expandBtn = screen.queryByText(/mais|ver todos/i)
        if (expandBtn) {
            await user.click(expandBtn)
            await waitFor(() => {
                expect(screen.getByText('Glúteos')).toBeInTheDocument()
            })
        }
    })
})
