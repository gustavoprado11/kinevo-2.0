'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, SkipForward } from 'lucide-react'

interface RestTimerOverlayProps {
    endTime: number
    duration: number
    onSkip: () => void
    onAddTime: () => void
}

export function RestTimerOverlay({ endTime, duration, onSkip, onAddTime }: RestTimerOverlayProps) {
    const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)))

    useEffect(() => {
        const interval = setInterval(() => {
            const r = Math.max(0, Math.ceil((endTime - Date.now()) / 1000))
            setRemaining(r)
            if (r <= 0) {
                clearInterval(interval)
                // Auto-dismiss after reaching 0
                setTimeout(onSkip, 500)
            }
        }, 100)
        return () => clearInterval(interval)
    }, [endTime, onSkip])

    // SVG circular progress
    const radius = 27
    const circumference = 2 * Math.PI * radius
    const progress = duration > 0 ? remaining / duration : 0

    const minutes = Math.floor(remaining / 60)
    const seconds = remaining % 60
    const timeDisplay = minutes > 0
        ? `${minutes}:${seconds.toString().padStart(2, '0')}`
        : `${seconds}s`

    return (
        <div className="fixed bottom-6 right-6 z-dropdown flex items-center gap-3 rounded-2xl bg-slate-900/95 dark:bg-surface-card border border-slate-700 dark:border-k-border-subtle shadow-2xl px-5 py-4 backdrop-blur-sm">
            {/* Circular timer */}
            <div className="relative flex items-center justify-center" style={{ width: 72, height: 72 }}>
                <svg width={72} height={72} className="-rotate-90">
                    {/* Background circle */}
                    <circle
                        cx={36}
                        cy={36}
                        r={radius}
                        fill="none"
                        stroke="rgba(124, 58, 237, 0.15)"
                        strokeWidth={4}
                    />
                    {/* Progress circle */}
                    <circle
                        cx={36}
                        cy={36}
                        r={radius}
                        fill="none"
                        stroke="#7c3aed"
                        strokeWidth={4}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference * (1 - progress)}
                        style={{ transition: 'stroke-dashoffset 0.1s linear' }}
                    />
                </svg>
                <span className="absolute text-lg font-bold text-white tabular-nums">
                    {timeDisplay}
                </span>
            </div>

            <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    Descanso
                </span>
                <div className="flex gap-2">
                    <button
                        onClick={onAddTime}
                        className="flex items-center gap-1 rounded-lg bg-violet-600/20 px-2.5 py-1.5 text-xs font-semibold text-violet-400 hover:bg-violet-600/30 transition-colors"
                    >
                        <Plus size={12} />
                        15s
                    </button>
                    <button
                        onClick={onSkip}
                        className="flex items-center gap-1 rounded-lg bg-slate-700/50 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700/80 transition-colors"
                    >
                        <SkipForward size={12} />
                        Pular
                    </button>
                </div>
            </div>
        </div>
    )
}
