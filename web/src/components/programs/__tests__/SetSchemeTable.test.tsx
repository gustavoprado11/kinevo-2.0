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

    it('applying a preset chip rewrites the scheme and sets methodKey + defaultRounds', () => {
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'standard'}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /pirâmide ↓/i }))

        expect(onChange).toHaveBeenCalledTimes(1)
        const [next, key, rounds] = onChange.mock.calls[0]
        expect(key).toBe('pyramid_down')
        expect(next.map((s) => s.reps)).toEqual(['12', '10', '8', '6'])
        // Pyramid is linear → defaultRounds = 1
        expect(rounds).toBe(1)
    })

    it('applying a compound preset (drop-set) seeds rounds = SYSTEM_PRESETS.defaultRounds (3)', () => {
        const onChange = vi.fn<OnChangeMock>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'standard'}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /drop-set/i }))

        const [, key, rounds] = onChange.mock.calls[0]
        expect(key).toBe('drop_set')
        expect(rounds).toBe(3)
    })

    it('editing a cell after a preset demotes methodKey to custom but preserves rounds', () => {
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
        expect(key).toBe('custom')
        expect(rounds).toBe(1)
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

    it('renders the "Aluno verá" footer when rounds > 1', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
                onExitAdvanced={() => {}}
            />,
        )
        // 3 rounds × 3 phases = 9 phases total
        expect(screen.getByText(/aluno verá/i)).toBeTruthy()
        expect(screen.getByText(/9 fases no total/i)).toBeTruthy()
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

    it('hides RIR and Tempo columns by default and reveals them when "Mais campos" is clicked', () => {
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

        // Collapsed by default — RIR / Tempo headers are not in the DOM.
        expect(screen.queryByText(/^RIR$/i)).toBeNull()
        expect(screen.queryByText(/^Tempo$/i)).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: /mais campos/i }))

        expect(screen.getByText(/^RIR$/i)).toBeTruthy()
        expect(screen.getByText(/^Tempo$/i)).toBeTruthy()
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
