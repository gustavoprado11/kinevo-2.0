'use client'

import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

interface WorkoutTimerProps {
    startedAt: number // Date.now() timestamp
}

export function WorkoutTimer({ startedAt }: WorkoutTimerProps) {
    const [elapsed, setElapsed] = useState(0)

    useEffect(() => {
        const update = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
        update()
        const interval = setInterval(update, 1000)
        return () => clearInterval(interval)
    }, [startedAt])

    const minutes = Math.floor(elapsed / 60)
    const seconds = elapsed % 60
    const display = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

    return (
        <div className="flex items-center gap-2 rounded-lg bg-glass-bg px-3 py-1.5">
            <Timer size={14} className="text-emerald-400" />
            <span className="text-sm font-mono font-semibold text-foreground tabular-nums">
                {display}
            </span>
        </div>
    )
}
