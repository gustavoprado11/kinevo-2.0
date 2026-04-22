'use client'

import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, MessageCircle } from 'lucide-react'
import { useSearchParams } from 'next/navigation'
import { useCommunicationStore } from '@/stores/communication-store'
import { AssistantPanelContent } from './assistant-panel-content'
import { MessagesPanelContent } from './messages-panel-content'

export function UnifiedCommunicationPanel() {
    const {
        isOpen,
        activeTab,
        closePanel,
        switchTab,
        openPanel,
        openChat,
        openConversation,
    } = useCommunicationStore()

    const searchParams = useSearchParams()

    // Handle deep links via query params
    useEffect(() => {
        const panel = searchParams.get('panel')
        if (panel === 'messages') {
            const studentId = searchParams.get('student')
            openPanel('messages')
            if (studentId) openConversation(studentId)
        } else if (panel === 'assistant') {
            const insightId = searchParams.get('insight')
            openChat(insightId ? { insightId } : undefined)
        }
    }, [searchParams, openPanel, openConversation, openChat])

    // Fechar o painel ao pressionar ESC. Complementa o botão X, o backdrop e
    // o gesto de deslizar: os três padrões "de fechar" que o usuário pode
    // esperar já estão cobertos.
    useEffect(() => {
        if (!isOpen) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closePanel()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [isOpen, closePanel])

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-dropdown bg-black/20 backdrop-blur-sm"
                        onClick={closePanel}
                    />

                    {/* Panel */}
                    <motion.aside
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed right-0 top-0 z-modal flex h-full w-full max-w-[450px] flex-col border-l border-border bg-background shadow-2xl"
                    >
                        {/* Header with tabs */}
                        <header className="flex items-center border-b border-border">
                            <button
                                onClick={() => switchTab('assistant')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                                    activeTab === 'assistant'
                                        ? 'text-violet-600 dark:text-violet-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <Sparkles className="w-3.5 h-3.5" />
                                Assistente
                                {activeTab === 'assistant' && (
                                    <motion.div
                                        layoutId="panel-tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500"
                                    />
                                )}
                            </button>
                            <button
                                onClick={() => switchTab('messages')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                                    activeTab === 'messages'
                                        ? 'text-blue-600 dark:text-blue-400'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                <MessageCircle className="w-3.5 h-3.5" />
                                Mensagens
                                {activeTab === 'messages' && (
                                    <motion.div
                                        layoutId="panel-tab-indicator"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"
                                    />
                                )}
                            </button>
                            <button
                                onClick={closePanel}
                                className="p-2 mr-2 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                            >
                                <X className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </header>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden relative">
                            <AnimatePresence mode="wait" initial={false}>
                                {activeTab === 'assistant' ? (
                                    <motion.div
                                        key="assistant"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute inset-0"
                                    >
                                        <AssistantPanelContent />
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="messages"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="absolute inset-0"
                                    >
                                        <MessagesPanelContent />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    )
}
