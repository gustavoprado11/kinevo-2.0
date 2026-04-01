'use client'

import { useState, useEffect, useCallback } from 'react'
import { MessageCircle } from 'lucide-react'
import { useCommunicationStore } from '@/stores/communication-store'
import { createClient } from '@/lib/supabase/client'
import { getConversations } from '@/app/messages/actions'
import { ConversationList } from '@/components/messages/conversation-list'
import { ChatPanel } from '@/components/messages/chat-panel'
import type { Conversation } from '@/types/messages'

export function MessagesPanelContent() {
    const { selectedStudentId, messagesView, openConversation, backToList, decrementUnreadMessages } = useCommunicationStore()
    const [conversations, setConversations] = useState<Conversation[]>([])
    const [trainerId, setTrainerId] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    // Load trainer ID and conversations on mount
    useEffect(() => {
        const load = async () => {
            try {
                const supabase = createClient()
                const { data: { user } } = await supabase.auth.getUser()
                if (user) {
                    const { data: trainer } = await supabase
                        .from('trainers')
                        .select('id')
                        .eq('auth_user_id', user.id)
                        .single()
                    if (trainer) setTrainerId(trainer.id)
                }
                const convs = await getConversations()
                setConversations(convs)
            } catch {
                // ignore
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [])

    const selectedConversation = conversations.find(c => c.student.id === selectedStudentId)

    const handleSelectConversation = useCallback((studentId: string) => {
        // Decrement badge by this conversation's unread count
        const conv = conversations.find(c => c.student.id === studentId)
        if (conv && conv.unreadCount > 0) {
            decrementUnreadMessages(conv.unreadCount)
        }

        openConversation(studentId)
        // Mark as read locally in conversation list
        setConversations(prev =>
            prev.map(c => c.student.id === studentId ? { ...c, unreadCount: 0 } : c)
        )
    }, [openConversation, conversations, decrementUnreadMessages])

    const handleConversationUpdate = useCallback((updatedConversations: Conversation[]) => {
        setConversations(updatedConversations)
    }, [])

    const handleBack = useCallback(() => {
        backToList()
    }, [backToList])

    // Conversation view
    if (messagesView === 'conversation' && selectedStudentId && selectedConversation) {
        return (
            <div className="flex flex-col h-full">
                <ChatPanel
                    studentId={selectedStudentId}
                    studentName={selectedConversation.student.name}
                    studentAvatar={selectedConversation.student.avatar_url}
                    onBack={handleBack}
                />
            </div>
        )
    }

    // Loading state
    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#007AFF]/20 dark:border-violet-500/20 border-t-[#007AFF] dark:border-t-violet-500 rounded-full animate-spin" />
                    <p className="text-xs text-muted-foreground">Carregando conversas...</p>
                </div>
            </div>
        )
    }

    // List view
    return (
        <div className="flex flex-col h-full">
            <ConversationList
                conversations={conversations}
                selectedStudentId={selectedStudentId}
                onSelect={handleSelectConversation}
                onConversationsUpdate={handleConversationUpdate}
                trainerId={trainerId || ''}
            />
        </div>
    )
}
