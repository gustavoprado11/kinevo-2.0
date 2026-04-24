import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekNavigator } from '../week-navigator'

describe('WeekNavigator', () => {
    it('mostra range "DD–DD mês" quando mesma sorte', () => {
        render(
            <WeekNavigator
                weekStart="2026-04-19"
                isNavigating={false}
                onPrevious={() => {}}
                onNext={() => {}}
                onToday={() => {}}
            />,
        )
        // 19 a 25 de abril
        expect(screen.getByText(/19–25 abr/i)).toBeInTheDocument()
    })

    it('mostra range atravessando meses "DD mês – DD mês"', () => {
        render(
            <WeekNavigator
                weekStart="2026-04-26"
                isNavigating={false}
                onPrevious={() => {}}
                onNext={() => {}}
                onToday={() => {}}
            />,
        )
        expect(screen.getByText(/26 abr – 02 mai/i)).toBeInTheDocument()
    })

    it('chama onPrevious ao clicar no botão', () => {
        const onPrev = vi.fn()
        render(
            <WeekNavigator
                weekStart="2026-04-19"
                isNavigating={false}
                onPrevious={onPrev}
                onNext={() => {}}
                onToday={() => {}}
            />,
        )
        fireEvent.click(screen.getByLabelText(/Semana anterior/i))
        expect(onPrev).toHaveBeenCalledTimes(1)
    })

    it('chama onNext ao clicar no botão', () => {
        const onNext = vi.fn()
        render(
            <WeekNavigator
                weekStart="2026-04-19"
                isNavigating={false}
                onPrevious={() => {}}
                onNext={onNext}
                onToday={() => {}}
            />,
        )
        fireEvent.click(screen.getByLabelText(/Próxima semana/i))
        expect(onNext).toHaveBeenCalledTimes(1)
    })

    it('chama onToday ao clicar em Hoje', () => {
        const onToday = vi.fn()
        render(
            <WeekNavigator
                weekStart="2026-04-19"
                isNavigating={false}
                onPrevious={() => {}}
                onNext={() => {}}
                onToday={onToday}
            />,
        )
        fireEvent.click(screen.getByText('Hoje'))
        expect(onToday).toHaveBeenCalledTimes(1)
    })
})
