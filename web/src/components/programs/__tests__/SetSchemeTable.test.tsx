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
            />,
        )
        expect(screen.getByText(/adicionar fase/i)).toBeTruthy()
        expect(screen.queryByText(/adicionar série/i)).toBeNull()
    })

    it('renders the rounds structure at the TOP for compound methods (title + stepper)', () => {
        // Redesign (519ee80): the summary pill ("3 rodadas × 3 fases · 9 fases
        // totais") was replaced by a section header. For compound methods the
        // title reads "Estrutura de uma rodada" and the RoundsStepper shows
        // the round count — same info (structure visible BEFORE editing),
        // new presentation.
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
            />,
        )
        expect(screen.getByText(/estrutura de uma rodada/i)).toBeTruthy()
        // Stepper exposes the rounds count (label "Rodadas" + value 3).
        // Scoped to the stepper container — a bare getByText('3') would also
        // match the set-number cell of the 3rd row.
        const stepper = screen.getByText(/^rodadas$/i).closest('div')
        expect(stepper?.textContent).toContain('3')
        // Old pill/footer texts are gone.
        expect(screen.queryByText(/fases totais/i)).toBeNull()
        expect(screen.queryByText(/aluno verá/i)).toBeNull()
    })

    it('renders the "Fases" section title (no rounds UI) for linear customizado', () => {
        // Redesign (519ee80): linear methods no longer show a "N fases" pill;
        // the section is simply titled "Fases" and has no rounds stepper nor
        // explanatory tooltip.
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'custom'}
                rounds={1}
                onChange={() => {}}
            />,
        )
        expect(screen.getByText(/^fases$/i)).toBeTruthy()
        expect(screen.queryByText(/^rodadas$/i)).toBeNull()
        expect(
            screen.queryByLabelText(/como funciona a estrutura de rodadas/i),
        ).toBeNull()
    })

    it('hides the structure summary pill for single-phase schemes', () => {
        const singlePhase = [initialScheme[0]]
        render(
            <SetSchemeTable
                value={singlePhase}
                methodKey={'cluster'}
                rounds={1}
                onChange={() => {}}
            />,
        )
        // 1 phase, no rounds expansion — pill is hidden (no compelling
        // structural summary to show).
        expect(screen.queryByText(/fases totais/i)).toBeNull()
        expect(screen.queryByText(/^1 fase$/i)).toBeNull()
    })

    it('explains the repeated structure via the Info tooltip for compound methods', () => {
        // Redesign (519ee80): the inline banner became an Info icon next to
        // the section title; the explanation now lives in its title attribute
        // (native tooltip). Same copy, on-demand instead of always visible.
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'drop_set'}
                rounds={3}
                onChange={() => {}}
            />,
        )
        const infoIcon = screen.getByLabelText(/como funciona a estrutura de rodadas/i)
        const tooltip = infoIcon.getAttribute('title') ?? ''
        expect(tooltip).toMatch(/3 fases/i)
        expect(tooltip).toMatch(/repetida 3 vezes/i)
        expect(tooltip).toMatch(/cada rodada inteira conta como 1 série efetiva/i)
    })

    it('does not render the rounds banner for linear methods (rounds=1)', () => {
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                rounds={1}
                onChange={() => {}}
            />,
        )
        expect(screen.queryByText(/repetida \d+ vezes/i)).toBeNull()
    })

    it('hides RIR and Cadência columns by default and reveals each via its own toggle chip', () => {
        // Redesign (519ee80): the single "Prescrever RIR e Cadência" toggle
        // was split into two independent chips ("RIR" / "Cadência") persisted
        // in separate localStorage keys. Reset all keys (including the legacy
        // one, still read on first hydration) so the test starts collapsed.
        window.localStorage.removeItem('kinevo_setscheme_show_rir')
        window.localStorage.removeItem('kinevo_setscheme_show_tempo')
        window.localStorage.removeItem('kinevo_setscheme_advanced_fields')

        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'standard'}
                rounds={1}
                onChange={() => {}}
            />,
        )

        // Collapsed by default — RIR / Cadência column headers are not in the
        // DOM (the chips read "+ RIR" / "+ Cadência", so the exact-match
        // queries below only hit the <th> headers).
        expect(screen.queryByText(/^RIR$/i)).toBeNull()
        expect(screen.queryByText(/^Cadência$/i)).toBeNull()

        // Toggles are independent: enabling RIR must NOT reveal Cadência.
        fireEvent.click(screen.getByRole('button', { name: /rir/i }))
        expect(screen.getByText(/^RIR$/i)).toBeTruthy()
        expect(screen.queryByText(/^Cadência$/i)).toBeNull()

        fireEvent.click(screen.getByRole('button', { name: /cadência/i }))
        expect(screen.getByText(/^RIR$/i)).toBeTruthy()
        expect(screen.getByText(/^Cadência$/i)).toBeTruthy()
    })

    // Os 2 testes de "Voltar para modo simples" foram removidos junto com
    // o link. A saída do modo avançado agora é responsabilidade do toggle
    // no top-right do WorkoutItemCard (workout-item-card.tsx) e está coberta
    // implicitamente pelos testes desse componente — não é mais
    // responsabilidade do SetSchemeTable.
})
