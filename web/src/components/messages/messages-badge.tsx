'use client'

import { useEffect, useState } from 'react'
import { getTotalUnreadCount } from '@/app/messages/actions'

export function MessagesBadge() {
    const [count, setCount] = useState(0)

    useEffect(() => {
        getTotalUnreadCount()
            .then(c => setCount(c))
            .catch(() => {})
    }, [])

    if (count === 0) return null

    return (
        <span className="ml-auto flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full bg-red-500 text-white">
            {count > 99 ? '99+' : count}
        </span>
    )
}
