'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'

interface TrainerNoteProps {
    note: string
    isTrainerView?: boolean
}

export function TrainerNote({ note, isTrainerView }: TrainerNoteProps) {
    const [expanded, setExpanded] = useState(false)

    return (
        <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex items-start gap-2 mt-2 w-full text-left rounded-xl bg-[#007AFF]/5 dark:bg-violet-500/5 border border-[#007AFF]/10 dark:border-violet-500/10 px-3 py-2.5 transition-colors hover:bg-[#007AFF]/10 dark:hover:bg-violet-500/10"
        >
            <MessageSquare size={13} className="text-[#007AFF] dark:text-violet-400 mt-0.5 shrink-0" />
            <p className={`text-xs text-[#6E6E73] dark:text-violet-300/80 leading-relaxed ${expanded ? '' : 'line-clamp-2'}`}>
                {isTrainerView && <span className="font-semibold text-[#007AFF] dark:text-violet-400">Sua nota: </span>}
                {note}
            </p>
        </button>
    )
}
