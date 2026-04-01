'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalUnreadCount } from '@/app/messages/actions'
import { useCommunicationStore } from '@/stores/communication-store'

/**
 * Initializes and keeps `unreadMessagesCount` in the communication store
 * reactive via Supabase Realtime. Call once in the dashboard header (or any
 * component that needs the badge to stay current).
 */
export function useUnreadMessagesCount() {
    const setUnreadMessagesCount = useCommunicationStore(s => s.setUnreadMessagesCount)
    const incrementUnreadMessages = useCommunicationStore(s => s.incrementUnreadMessages)

    useEffect(() => {
        // Initial fetch
        getTotalUnreadCount()
            .then(setUnreadMessagesCount)
            .catch(() => {})

        // Realtime: listen for new student messages → increment
        const supabase = createClient()

        const channel = supabase
            .channel('unread_badge')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: 'sender_type=eq.student',
                },
                () => {
                    incrementUnreadMessages(1)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [setUnreadMessagesCount, incrementUnreadMessages])
}
