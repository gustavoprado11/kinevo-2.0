import { create } from 'zustand'

interface CommunicationState {
    // Panel state
    isOpen: boolean
    activeTab: 'assistant' | 'messages'

    // Assistant state
    studentId: string | null
    studentName: string | null
    insightId: string | null
    /** Cartão de contexto na voz do assistente (não é mensagem persistida). */
    initialMessage: string | null
    /** Texto que entra no COMPOSER para o treinador revisar antes de enviar. */
    prefill: string | null
    /** Muda a cada openChat: reaplica o prefill mesmo quando o texto é idêntico. */
    prefillNonce: number

    // Messages state
    selectedStudentId: string | null
    messagesView: 'list' | 'conversation'
    unreadMessagesCount: number

    // Panel actions
    openPanel: (tab: 'assistant' | 'messages') => void
    closePanel: () => void
    switchTab: (tab: 'assistant' | 'messages') => void

    // Assistant actions (backwards-compatible)
    openChat: (opts?: { studentId?: string; studentName?: string; insightId?: string; initialMessage?: string; prefill?: string }) => void
    closeChat: () => void

    // Messages actions
    openConversation: (studentId: string) => void
    backToList: () => void
    setUnreadMessagesCount: (count: number) => void
    incrementUnreadMessages: (by: number) => void
    decrementUnreadMessages: (by: number) => void
}

export const useCommunicationStore = create<CommunicationState>()((set) => ({
    isOpen: false,
    activeTab: 'assistant',

    studentId: null,
    studentName: null,
    insightId: null,
    initialMessage: null,
    prefill: null,
    prefillNonce: 0,

    selectedStudentId: null,
    messagesView: 'list',
    unreadMessagesCount: 0,

    openPanel: (tab) => set({ isOpen: true, activeTab: tab }),

    closePanel: () => set({ isOpen: false }),

    switchTab: (tab) => set({ activeTab: tab }),

    openChat: (opts) => set((state) => ({
        isOpen: true,
        activeTab: 'assistant',
        studentId: opts?.studentId ?? null,
        studentName: opts?.studentName ?? null,
        insightId: opts?.insightId ?? null,
        initialMessage: opts?.initialMessage ?? null,
        prefill: opts?.prefill ?? null,
        prefillNonce: state.prefillNonce + 1,
    })),

    closeChat: () => set({ isOpen: false }),

    openConversation: (studentId) => set({
        selectedStudentId: studentId,
        messagesView: 'conversation',
    }),

    backToList: () => set({
        selectedStudentId: null,
        messagesView: 'list',
    }),

    setUnreadMessagesCount: (count) => set({ unreadMessagesCount: count }),

    incrementUnreadMessages: (by) => set((state) => ({
        unreadMessagesCount: state.unreadMessagesCount + by,
    })),

    decrementUnreadMessages: (by) => set((state) => ({
        unreadMessagesCount: Math.max(0, state.unreadMessagesCount - by),
    })),
}))

// Backwards-compatible alias
export const useAssistantChatStore = useCommunicationStore
