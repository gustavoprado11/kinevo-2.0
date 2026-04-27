import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SetSchemeTable } from '../SetSchemeTable'
import type { MethodKey, WorkoutSet } from '@kinevo/shared/types/prescription'

const initialScheme: WorkoutSet[] = [
    { set_number: 1, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
    { set_number: 2, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
    { set_number: 3, set_type: 'normal', reps: '10', rest_seconds: 60, weight_target_kg: null, weight_target_pct1rm: null, rir: null, tempo: null, notes: null },
]

describe('SetSchemeTable', () => {
    it('renders one row per set with editable reps', () => {
        const onChange = vi.fn()
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

    it('applying a preset chip rewrites the scheme and sets methodKey', () => {
        const onChange = vi.fn<(s: WorkoutSet[], k: MethodKey) => void>()
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
        const [next, key] = onChange.mock.calls[0]
        expect(key).toBe('pyramid_down')
        expect(next.map((s) => s.reps)).toEqual(['12', '10', '8', '6'])
    })

    it('editing a cell after a preset demotes methodKey to custom', () => {
        const onChange = vi.fn<(s: WorkoutSet[], k: MethodKey) => void>()
        render(
            <SetSchemeTable
                value={initialScheme}
                methodKey={'pyramid_down'}
                onChange={onChange}
                onExitAdvanced={() => {}}
            />,
        )

        const repsInput = screen.getByLabelText('Reps da série 1')
        fireEvent.change(repsInput, { target: { value: '15' } })

        expect(onChange).toHaveBeenCalledTimes(1)
        const [, key] = onChange.mock.calls[0]
        expect(key).toBe('custom')
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
