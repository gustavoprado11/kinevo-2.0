import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SetSchemeTable } from '../SetSchemeTable'
import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription'

const initialScheme: WorkoutSet[] = [
    { set_number: 1, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
    { set_number: 2, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
    { set_number: 3, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
]

type OnChangeMock = (s: WorkoutSet[], k: MethodKey, r: number) => void

describe('SetSchemeTable', () => {
    it('renders one row per set with editable reps', () => {
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'standard'}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )
        expect(screen.getAllByRole('row')).toHaveLength(initialScheme.length + 1) // +1 for thead
    })

    it('applying a preset chip rewrites the scheme and sets methodKey + defaultRounds (no confirm)', () => {
        // Fase 4.5e §2: applying a preset is a direct action — no confirm
        // dialog gates it. Trainer is intentional when clicking a chip.
        const onChange = vi.fn<OnChangeMock>()
        const confirmSpy = vi.spyOn(window, 'confirm')
        try {
            render(
                <SetSchemeTable
                    value={initialScheme}
                    methodKey={'standard'}
                    onChange={onChange}
                    onExitAdvanced={() => {}}
                />,
            )

            fireEvent.click(screen.getByRole('button', { name: /pirâmide ↓/i }))

            expect(confirmSpy).not.toHaveBeenCalled()
            expect(onChange).toHaveBeenCalledTimes(1)
            const [next, key, rounds] = onChange.mock.calls[0]
            expect(key).toBe('pyramid_down')
            expect(next.map((s) => s.reps)).toEqual(['12', '10', '8', '6'])
            // Pyramid is linear → defaultRounds = 1
            expect(rounds).toBe(1)
        } finally {
            confirmSpy.mockRestore()
        }
    })

    it('applying a compound preset (drop-set) seeds rounds = SYSTEM_PRESETS.defaultRounds (3)', () => {
        const onChange = vi.fn<OnChangeMock>()
        const confirmSpy = vi.spyOn(window, 'confirm')
        try {
            render(
                <SetSchemeTable
                    value={initialScheme}
                    methodKey={'standard'}
                    onChange={onChange}
                    onExitAdvanced={() => {}}
                />,
            )

            fireEvent.click(screen.getByRole('button', { name: /drop-set/i }))

            // Fase 4.5e §2: no confirm — preset applies directly.
            expect(confirmSpy).not.toHaveBeenCalled()
            expect(onChange).toHaveBeenCalledTimes(1)
            const [, key, rounds] = onChange.mock.calls[0]
            expect(key).toBe('drop_set')
            expect(rounds).toBe(3)
        } finally {
            confirmSpy.mockRestore()
        }
    })

    it('switching between presets applies directly without prompting', () => {
        // Fase 4.5e §2: replaces the previous "cancel confirm" test from
        // Fase 4.5d. Trainer can A/B between methods quickly.
        const onChange = vi.fn<OnChangeMock>()
        const confirmSpy = vi.spyOn(window, 'confirm')
        try {
            render(
                <SetSchemeTable
                    value={initialScheme}
                    methodKey={'pyramid_down'}
                    rounds={1}
                    onChange={onChange}
                    onExitAdvanced={() => {}}
                />,
            )

            fireEvent.click(screen.getByRole('button', { name: /drop-set/i }))

            expect(confirmSpy).not.toHaveBeenCalled()
            expect(onChange).toHaveBeenCalledTimes(1)
            const [, key, rounds] = onChange.mock.calls[0]
            expect(key).toBe('drop_set')
            expect(rounds).toBe(3)
        } finally {
            confirmSpy.mockRestore()
        }
    })

    it('editing a cell PRESERVES methodKey and rounds (Fase 4.5d §7 — intent is sacred)', () => {
        // Pre-Fase-4.5d this test asserted that editing flipped the chip to
        // 'custom'. New behaviour: only clicking a chip changes method_key.
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                rounds={1}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        const repsInput = screen.getByLabelText('Reps da série 1')
        fireEvent.change(repsInput, { target: { value: '15' } })

        expect(onChange).toHaveBeenCalledTimes(1)
        const [, key, rounds] = onChange.mock.calls[0]
        expect(key).toBe('pyramid_down')
        expect(rounds).toBe(1)
    })

    it('clicking the Customizado chip preserves the scheme and rounds, only labels as custom', () => {
        // Fase 4.5d §1+§7: 7th chip is manually clickable; preserves
        // structure (no scheme overwrite, no confirm).
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                rounds={1}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /customizado/i }))

        expect(onChange).toHaveBeenCalledTimes(1)
        const [next, key, rounds] = onChange.mock.calls[0]
        expect(key).toBe('custom')
        expect(rounds).toBe(1)
        expect(next.map((s) => s.reps)).toEqual(['10', '10', '10']) // unchanged
    })

    it('rounds stepper appears for compound methods and clamps to [1, 20]', () => {
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        // The stepper buttons exist for compound methods.
        const inc = screen.getByRole('button', { name: /aumentar rodadas/i })
        const dec = screen.getByRole('button', { name: /diminuir rodadas/i })

        fireEvent.click(inc)
        let [, , rounds] = onChange.mock.calls[onChange.mock.calls.length - 1]
        expect(rounds).toBe(4)

        fireEvent.click(dec)
        ;[, , rounds] = onChange.mock.calls[onChange.mock.calls.length - 1]
        // dec triggers from the prop value (3), not from the just-emitted 4 —
        // SetSchemeTable is controlled, so the component still sees rounds=3
        // until the parent re-renders. Both invocations therefore go through
        // clamp from the SAME baseline.
        expect(rounds).toBe(2)
    })

    it('rounds stepper is hidden for linear methods', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                rounds={1}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        expect(screen.queryByRole('button', { name: /aumentar rodadas/i })).toBeNull()
    })

    it('shows "Adicionar fase" instead of "Adicionar série" for compound methods', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        expect(screen.getByText(/adicionar fase/i)).toBeTruthy()
        expect(screen.queryByText(/adicionar série/i)).toBeNull()
    })

    it('renders the structure summary pill at the TOP when rounds > 1', () => {
        // Fase 4.5d §5: footer "Aluno verá: ..." was removed; the same info
        // (rounds × phases = total) now lives in the summary pill at the top
        // of the section so the trainer sees it BEFORE editing the table.
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        // 3 rounds × 3 phases = 9 phases total — pill text reads
        // "3 rodadas × 3 fases · 9 fases totais"
        expect(screen.getByText(/3 rodadas × 3 fases · 9 fases totais/i)).toBeTruthy()
        // Footer text from previous Fase is gone.
        expect(screen.queryByText(/aluno verá/i)).toBeNull()
    })

    it('renders the structure summary pill for linear customizado (rounds=1, length>1)', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'custom'}
                rounds={1}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        // Linear customizado with 3 phases shows just "N fases".
        expect(screen.getByText(/^3 fases$/i)).toBeTruthy()
    })

    it('hides the structure summary pill for single-phase schemes', () => {
        const singlePhase = [initialScheme[0]]
        render(
            <SetSchemeTable
                value={singlePhase}
                methodKey={'cluster'}
                rounds={1}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        // 1 phase, no rounds expansion — pill is hidden (no compelling
        // structural summary to show).
        expect(screen.queryByText(/fases totais/i)).toBeNull()
        expect(screen.queryByText(/^1 fase$/i)).toBeNull()
    })

    it('renders the rounds banner explaining repeated structure for compound methods', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        // Banner mentions "3 fases ... repetida 3 vezes" for the visible scheme.
        expect(screen.getByText(/repetida 3 vezes/i)).toBeTruthy()
        expect(screen.getByText(/Cada rodada inteira conta como 1 série efetiva/i)).toBeTruthy()
    })

    it('does not render the rounds banner for linear methods (rounds=1)', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                rounds={1}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        expect(screen.queryByText(/repetida \d+ vezes/i)).toBeNull()
    })

    it('hides RIR and Cadência columns by default and reveals them when "Mais campos" is clicked', () => {
        // Reset localStorage so the test starts in the default (collapsed) state.
        window.localStorage.removeItem('kinevo_setscheme_advanced_fields')

        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'standard'}
                rounds={1}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )

        // Collapsed by default — RIR / Cadência headers are not in the DOM.
        // Fase 4.5h: header was renamed from "Tempo" to "Cadência" (BR
        // personal-training jargon). Internal field is still `tempo`.
        expect(screen.queryByText(/^RIR$/i)).toBeNull()
        expect(screen.queryByText(/^Cadência$/i)).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: /mais campos/i }))

        expect(screen.getByText(/^RIR$/i)).toBeTruthy()
        expect(screen.getByText(/^Cadência$/i)).toBeTruthy()
    })

    it('exit advanced asks for confirmation', () => {
        const onExitAdvanced = vi.fn()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
        try {
            render(
                <SetSchemeTable
                    value={initialScheme}
                    methodKey={'standard'}
                    onChange={() => {}}
                    onExitAdvanced={onExitAdvanced}
                />,
            )

            fireEvent.click(screen.getByText(/voltar para modo simples/i))

            expect(confirmSpy).toHaveBeenCalledTimes(1)
            expect(onExitAdvanced).toHaveBeenCalledTimes(1)
        } finally {
            confirmSpy.mockRestore()
        }
    })

    it('cancel on confirm dialog does not exit', () => {
        const onExitAdvanced = vi.fn()
        const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
        try {
            render(
                <SetSchemeTable
                    value={initialScheme}
                    methodKey={'standard'}
                    onChange={() => {}}
                    onExitAdvanced={onExitAdvanced}
                />,
            )

            fireEvent.click(screen.getByText(/voltar para modo simples/i))

            expect(onExitAdvanced).not.toHaveBeenCalled()
        } finally {
            confirmSpy.mockRestore()
        }
    })
})
