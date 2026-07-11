'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getTotalUnreadCount } from '@/app/messages/actions'
import { useCommunicationStore } from '@/stores/communication-store'

/**
 * Initializes and keeps `unreadMessagesCount` in the communication store
 * reactive via Supabase Realtime. Call once in the dashboard header (or any
 * component that needs the badge to stay current).
 *
 * M2 (auditoria 11/jul): o hook antigo só INCREMENTAVA no INSERT e nunca
 * reconciliava — com a conversa aberta (ChatPanel marca como lida na hora) o
 * badge inflava e só zerava com reload. Agora todo evento re-busca o COUNT
 * REAL (fonte de verdade considera read_at), com debounce; UPDATE cobre a
 * marcação de leitura (badge desce sozinho) e visibilitychange reconcilia
 * eventos perdidos com a aba em background.
 */
export function useUnreadMessagesCount() {
    const setUnreadMessagesCount = useCommunicationStore(s => s.setUnreadMessagesCount)

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const refetch = () => {
            getTotalUnreadCount()
                .then(setUnreadMessagesCount)
                .catch(() => {})
        }
        // Debounce: rajada de eventos (lote de mensagens) → 1 fetch.
        const scheduleRefetch = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(refetch, 400)
        }

        refetch()

        const supabase = createClient()
        const channel = supabase
            .channel('unread_badge')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages', filter: 'sender_type=eq.student' },
                scheduleRefetch,
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'messages', filter: 'sender_type=eq.student' },
                scheduleRefetch,
            )
            .subscribe()

        const onVisible = () => {
            if (document.visibilityState === 'visible') scheduleRefetch()
        }
        document.addEventListener('visibilitychange', onVisible)

        return () => {
            if (timer) clearTimeout(timer)
            document.removeEventListener('visibilitychange', onVisible)
            supabase.removeChannel(channel)
        }
    }, [setUnreadMessagesCount])
}
