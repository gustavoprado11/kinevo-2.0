'use client'

// Sync bidirecional início ↔ duração (semanas) ↔ fim do programa — idêntico
// nos dois builders, extraído pra cá.

import { useCallback, useState } from 'react'

/** Data final a partir do início + N semanas (inclusivo: 4 semanas = 28 dias - 1). */
export function calculateEndDate(start: string, weeksStr: string): string {
    const startObj = new Date(start)
    const weeks = parseInt(weeksStr) || 0
    if (isNaN(startObj.getTime())) return ''
    const endObj = new Date(startObj)
    endObj.setDate(endObj.getDate() + (weeks * 7) - 1)
    return endObj.toISOString().split('T')[0]
}

/** Semanas (arredondadas) entre início e fim, inclusivo. */
export function calculateWeeks(start: string, end: string): string {
    const startObj = new Date(start)
    const endObj = new Date(end)
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return '0'
    const diffTime = endObj.getTime() - startObj.getTime()
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1)
    return Math.round(diffDays / 7).toString()
}

export interface UseProgramScheduleOptions {
    initialStartDate: string
    initialWeeks: string
}

export function useProgramSchedule({ initialStartDate, initialWeeks }: UseProgramScheduleOptions) {
    const [startDate, setStartDate] = useState(initialStartDate)
    const [durationWeeks, setDurationWeeks] = useState(initialWeeks)
    const [isEndDateFixed, setIsEndDateFixed] = useState(false)
    const [endDate, setEndDate] = useState(() => calculateEndDate(initialStartDate, initialWeeks))

    const handleWeeksChange = useCallback((weeks: string) => {
        const weeksNum = Math.max(0, parseInt(weeks) || 0)
        const weeksStr = weeksNum.toString()
        setDurationWeeks(weeksStr)
        setEndDate(calculateEndDate(startDate, weeksStr))
    }, [startDate])

    const handleEndDateChange = useCallback((end: string) => {
        // Prevent end date being before start date
        if (new Date(end) < new Date(startDate)) {
            setEndDate(calculateEndDate(startDate, '0'))
            setDurationWeeks('0')
            return
        }
        setEndDate(end)
        setIsEndDateFixed(true)
        setDurationWeeks(calculateWeeks(startDate, end))
    }, [startDate])

    const handleStartDateChange = useCallback((start: string) => {
        setStartDate(start)
        setEndDate(calculateEndDate(start, durationWeeks))
    }, [durationWeeks])

    return {
        startDate,
        endDate,
        durationWeeks,
        setDurationWeeks,
        isEndDateFixed,
        handleWeeksChange,
        handleEndDateChange,
        handleStartDateChange,
    }
}
