'use client'

import { useState, useCallback } from 'react'
import { AppLayout } from '@/components/layout'
import { ConversationList } from '@/components/messages/conversation-list'
import { ChatPanel } from '@/components/messages/chat-panel'
import { MessageCircle } from 'lucide-react'
import type { Conversation } from '@/types/messages'

interface Trainer {
    id: string
    name: string
    email: string
    avatar_url?: string | null
    theme?: 'light' | 'dark' | 'system' | null
    onboarding_state?: any
}

interface MessagesClientProps {
    trainer: Trainer
    initialConversations: Conversation[]
}

export function MessagesClient({ trainer, initialConversations }: MessagesClientProps) {
    const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null)
    const [conversations, setConversations] = useState(initialConversations)

    const selectedConversation = conversations.find(c => c.student.id === selectedStudentId)

    const handleSelectConversation = useCallback((studentId: string) => {
        setSelectedStudentId(studentId)
        // Mark as read locally
        setConversations(prev =>
            prev.map(c => c.student.id === studentId ? { ...c, unreadCount: 0 } : c)
        )
    }, [])

    const handleConversationUpdate = useCallback((updatedConversations: Conversation[]) => {
        setConversations(updatedConversations)
    }, [])

    const handleBack = useCallback(() => {
        setSelectedStudentId(null)
    }, [])

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme}
            onboardingState={trainer.onboarding_state}
        >
            <div className="flex h-[calc(100vh-64px)] overflow-hidden -m-8">
                {/* Conversation list — hidden on mobile when chat is open */}
                <div className={`w-full md:w-80 lg:w-96 border-r border-[#D2D2D7] dark:border-k-border-subtle bg-white dark:bg-surface-card flex-shrink-0 ${selectedStudentId ? 'hidden md:flex' : 'flex'} flex-col`}>
                    <ConversationList
                        conversations={conversations}
                        selectedStudentId={selectedStudentId}
                        onSelect={handleSelectConversation}
                        onConversationsUpdate={handleConversationUpdate}
                        trainerId={trainer.id}
                    />
                </div>

                {/* Chat panel */}
                <div className={`flex-1 flex flex-col ${selectedStudentId ? 'flex' : 'hidden md:flex'}`}>
                    {selectedStudentId && selectedConversation ? (
                        <ChatPanel
                            studentId={selectedStudentId}
                            studentName={selectedConversation.student.name}
                            studentAvatar={selectedConversation.student.avatar_url}
                            onBack={handleBack}
                        />
                    ) : (
                        <div className="flex-1 flex items-center justify-center bg-[#F5F5F7] dark:bg-[#18181B]">
                            <div className="text-center">
                                <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-[#F5F5F7] dark:bg-glass-bg border border-[#E8E8ED] dark:border-k-border-subtle flex items-center justify-center">
                                    <MessageCircle size={24} strokeWidth={1.5} className="text-[#86868B] dark:text-k-text-quaternary" />
                                </div>
                                <h3 className="text-sm font-semibold text-[#1D1D1F] dark:text-white mb-1">
                                    Selecione uma conversa
                                </h3>
                                <p className="text-xs text-[#86868B] dark:text-k-text-quaternary max-w-[220px] mx-auto">
                                    Escolha um aluno na lista ao lado para iniciar uma conversa.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </AppLayout>
    )
}
