import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
    CALENDAR_END_HOUR,
    CALENDAR_START_HOUR,
    HOUR_HEIGHT_PX,
    HOURS,
    TimeGrid,
    pixelsToTime,
    timeToPixels,
} from '../time-grid'

describe('time-grid constants', () => {
    it('cobre 00:00 até 24:00 com step de 1h (24 labels)', () => {
        expect(CALENDAR_START_HOUR).toBe(0)
        expect(CALENDAR_END_HOUR).toBe(24)
        expect(HOURS).toEqual([
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11,
            12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        ])
    })
})

describe('timeToPixels', () => {
    it('00:00 fica no topo (0px)', () => {
        expect(timeToPixels('00:00')).toBe(0)
    })
    it('01:00 = 1 hora depois = HOUR_HEIGHT_PX', () => {
        expect(timeToPixels('01:00')).toBe(HOUR_HEIGHT_PX)
    })
    it('07:30 = 7.5 horas = 7.5 * HOUR_HEIGHT_PX', () => {
        expect(timeToPixels('07:30')).toBe(HOUR_HEIGHT_PX * 7.5)
    })
    it('aceita "HH:MM:SS"', () => {
        expect(timeToPixels('01:00:00')).toBe(HOUR_HEIGHT_PX)
    })
})

describe('pixelsToTime', () => {
    it('0px → 00:00', () => {
        expect(pixelsToTime(0)).toBe('00:00')
    })
    it('arredonda pra slot de 30min', () => {
        // ~01:10 arredonda pra 01:00 (<15min de 01:00)
        expect(pixelsToTime(HOUR_HEIGHT_PX + 10)).toBe('01:00')
    })
    it('clamp no limite inferior', () => {
        expect(pixelsToTime(-50)).toBe('00:00')
    })
    it('clamp no limite superior', () => {
        const hugePixels = HOUR_HEIGHT_PX * 100
        expect(pixelsToTime(hugePixels)).toBe('24:00')
    })
    it('07:30 roundtrip', () => {
        expect(pixelsToTime(timeToPixels('07:30'))).toBe('07:30')
    })
})

describe('TimeGrid component', () => {
    it('renderiza labels de hora de 00:00 até 23:00', () => {
        render(<TimeGrid />)
        expect(screen.getByText('00:00')).toBeInTheDocument()
        expect(screen.getByText('05:00')).toBeInTheDocument()
        expect(screen.getByText('12:00')).toBeInTheDocument()
        expect(screen.getByText('23:00')).toBeInTheDocument()
    })
})
