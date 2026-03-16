'use client'

import { useState } from 'react'
import { StickyNote, ChevronDown, ChevronUp } from 'lucide-react'

interface WorkoutNoteCardProps {
    note: string
    isTrainerView?: boolean
}

export function WorkoutNoteCard({ note, isTrainerView }: WorkoutNoteCardProps) {
    const [collapsed, setCollapsed] = useState(false)

    return (
        <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-start gap-3 w-full text-left rounded-2xl bg-[#007AFF]/5 dark:bg-violet-500/5 border border-[#007AFF]/10 dark:border-violet-500/10 px-4 py-3.5 transition-colors hover:bg-[#007AFF]/10 dark:hover:bg-violet-500/10"
        >
            <StickyNote size={15} className="text-[#007AFF] dark:text-violet-400 mt-0.5 shrink-0" />
            <p className={`text-xs text-[#6E6E73] dark:text-violet-300/80 leading-relaxed flex-1 ${collapsed ? 'line-clamp-1' : ''}`}>
                {isTrainerView && <span className="font-semibold text-[#007AFF] dark:text-violet-400">Sua nota: </span>}
                {note}
            </p>
            {collapsed ? (
                <ChevronDown size={14} className="text-[#007AFF] dark:text-violet-400 mt-0.5 shrink-0" />
            ) : (
                <ChevronUp size={14} className="text-[#007AFF] dark:text-violet-400 mt-0.5 shrink-0" />
            )}
        </button>
    )
}
