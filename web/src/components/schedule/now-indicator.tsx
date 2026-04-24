'use client'

import { useEffect, useState } from 'react'
import {
    CALENDAR_END_HOUR,
    CALENDAR_START_HOUR,
    HOUR_HEIGHT_PX,
} from './time-grid'

interface Props {
    /** YYYY-MM-DD de cada coluna do grid (7 itens). */
    daysOfWeek: string[]
}

function todayKeyBR(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

/** Hora atual no TZ São Paulo em minutos desde 00:00. */
function nowMinutesBR(): number {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    })
    const parts = Object.fromEntries(
        fmt.formatToParts(new Date()).map((p) => [p.type, p.value]),
    )
    return parseInt(parts.hour) * 60 + parseInt(parts.minute)
}

/**
 * Linha horizontal vermelha na coluna do dia atual, na altura da hora
 * atual. Se o dia atual não estiver na semana visível ou o horário
 * atual estiver fora da janela `CALENDAR_START_HOUR`–`CALENDAR_END_HOUR`
 * (hoje 00:00–24:00), não renderiza.
 *
 * Atualiza a cada 60s.
 */
export function NowIndicator({ daysOfWeek }: Props) {
    const [nowMinutes, setNowMinutes] = useState(() => nowMinutesBR())
    const [todayKey, setTodayKey] = useState(() => todayKeyBR())

    useEffect(() => {
        const tick = () => {
            setNowMinutes(nowMinutesBR())
            setTodayKey(todayKeyBR())
        }
        const id = setInterval(tick, 60_000)
        return () => clearInterval(id)
    }, [])

    const todayColumnIndex = daysOfWeek.indexOf(todayKey)
    if (todayColumnIndex === -1) return null

    const minutesFromStart = nowMinutes - CALENDAR_START_HOUR * 60
    const maxMinutes = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60
    if (minutesFromStart < 0 || minutesFromStart > maxMinutes) return null

    const topPx = (minutesFromStart / 60) * HOUR_HEIGHT_PX
    const leftPct = (todayColumnIndex / 7) * 100
    const widthPct = 100 / 7

    return (
        <div
            className="absolute pointer-events-none z-20"
            style={{
                top: `${topPx}px`,
                left: `${leftPct}%`,
                width: `${widthPct}%`,
            }}
            aria-label="Horário atual"
        >
            <div
                className="relative h-0.5"
                style={{
                    backgroundColor: '#FF3B30',
                    boxShadow: '0 0 4px rgba(255,59,48,0.6)',
                }}
            >
                <span
                    className="absolute -left-1 -top-1 w-2 h-2 rounded-full"
                    style={{ backgroundColor: '#FF3B30' }}
                />
            </div>
        </div>
    )
}
