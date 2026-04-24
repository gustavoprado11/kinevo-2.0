'use client'

export const CALENDAR_START_HOUR = 0
export const CALENDAR_END_HOUR = 24
export const HOUR_HEIGHT_PX = 56 // altura de 1 hora — 2 slots de 30min

/** Hora de posicionamento padrão ao abrir o calendário (primeira linha visível). */
export const DEFAULT_VISIBLE_START_HOUR = 5

/**
 * 24 entradas: 00..23. A linha 24:00 não tem label próprio — é o final do
 * canvas (igual borda inferior). Linhas separadoras entre horas = HOURS.length - 1.
 */
export const HOURS: number[] = Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i,
)

/** Altura total do canvas do calendário em pixels. */
export const CALENDAR_HEIGHT_PX =
    (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * HOUR_HEIGHT_PX

/** Converte "HH:MM" em offset vertical em pixels dentro do grid. */
export function timeToPixels(hhmm: string): number {
    const [hh, mm] = hhmm.slice(0, 5).split(':').map(Number)
    const totalMinutes = hh * 60 + mm - CALENDAR_START_HOUR * 60
    return (totalMinutes / 60) * HOUR_HEIGHT_PX
}

/** Converte offset em pixels dentro do grid → "HH:MM" arredondado no slot de 30min. */
export function pixelsToTime(pixels: number): string {
    const totalMinutes = (pixels / HOUR_HEIGHT_PX) * 60
    const slot = Math.round(totalMinutes / 30) * 30
    const clamped = Math.max(0, Math.min(slot, (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60))
    const absoluteMinutes = clamped + CALENDAR_START_HOUR * 60
    const hh = Math.floor(absoluteMinutes / 60)
    const mm = absoluteMinutes % 60
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
}

/**
 * Renderiza a coluna lateral de labels de hora (00:00, 01:00, ..., 23:00).
 * As linhas horizontais do grid são desenhadas em cada coluna de dia via
 * CSS grid, não aqui.
 */
export function TimeGrid() {
    return (
        <div
            className="relative w-14 flex-shrink-0 border-r border-[#E8E8ED] dark:border-k-border-subtle bg-white dark:bg-surface-card"
            style={{ height: `${CALENDAR_HEIGHT_PX}px` }}
            aria-hidden="true"
        >
            {HOURS.map((hour, idx) => (
                <div
                    key={hour}
                    className="absolute left-0 right-0 flex items-start justify-end pr-1.5 pt-0.5"
                    style={{ top: `${idx * HOUR_HEIGHT_PX - 6}px`, height: `${HOUR_HEIGHT_PX}px` }}
                >
                    <span className="text-[10px] font-medium text-[#AEAEB2] dark:text-k-text-quaternary tabular-nums">
                        {String(hour).padStart(2, '0')}:00
                    </span>
                </div>
            ))}
        </div>
    )
}
