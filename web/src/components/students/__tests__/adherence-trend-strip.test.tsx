import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdherenceTrendStrip } from '../adherence-trend-strip'

describe('AdherenceTrendStrip', () => {
    it('retorna null quando há menos de 2 pontos', () => {
        const { container } = render(<AdherenceTrendStrip weeklyAdherence={[{ week: 1, rate: 80 }]} />)
        expect(container.firstChild).toBeNull()
    })

    it('renderiza quando há ≥2 pontos com label e número médio', () => {
        const data = [
            { week: 1, rate: 100 },
            { week: 2, rate: 50 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        // 75% médio, label "Adesão 2 sem"
        expect(screen.getByText(/Adesão 2 sem/i)).toBeInTheDocument()
        expect(screen.getByText(/75%/i)).toBeInTheDocument()
    })

    it('normaliza taxas em escala 0–1 para 0–100', () => {
        const data = [
            { week: 1, rate: 0.4 },
            { week: 2, rate: 0.8 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        // (40 + 80) / 2 = 60
        expect(screen.getByText('60%')).toBeInTheDocument()
    })

    it('aceita taxas em escala 0–100 sem normalização extra', () => {
        const data = [
            { week: 1, rate: 60 },
            { week: 2, rate: 90 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        // (60 + 90) / 2 = 75
        expect(screen.getByText('75%')).toBeInTheDocument()
    })

    it('calcula delta entre últimas 2 e penúltimas 2 semanas', () => {
        // last2 = (40+60)/2 = 50; prev2 = (80+100)/2 = 90; delta = -40
        const data = [
            { week: 1, rate: 80 },
            { week: 2, rate: 100 },
            { week: 3, rate: 40 },
            { week: 4, rate: 60 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        expect(screen.getByText(/-40% últ\. 2 sem/i)).toBeInTheDocument()
    })

    it('exibe delta positivo com sinal +', () => {
        // last2 = (90+90)/2 = 90; prev2 = (50+50)/2 = 50; delta = +40
        const data = [
            { week: 1, rate: 50 },
            { week: 2, rate: 50 },
            { week: 3, rate: 90 },
            { week: 4, rate: 90 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        expect(screen.getByText(/\+40% últ\. 2 sem/i)).toBeInTheDocument()
    })

    it('dispara onWeekClick com identificador correto ao clicar num ponto', () => {
        const onWeekClick = vi.fn()
        const data = [
            { week: 5, rate: 70 },
            { week: 6, rate: 85 },
            { week: 7, rate: 30 },
        ]
        render(<AdherenceTrendStrip weeklyAdherence={data} onWeekClick={onWeekClick} />)
        // Clicar no ponto da semana 7 (rate 30 → vermelho).
        fireEvent.click(screen.getByTestId('trend-point-7'))
        expect(onWeekClick).toHaveBeenCalledWith(7)
    })

    it('limita a 12 últimas entradas quando há mais', () => {
        const data = Array.from({ length: 20 }, (_, i) => ({ week: i + 1, rate: 50 }))
        render(<AdherenceTrendStrip weeklyAdherence={data} />)
        // Label deve dizer "12 sem", não "20 sem".
        expect(screen.getByText(/Adesão 12 sem/i)).toBeInTheDocument()
    })
})
