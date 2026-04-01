import { create } from 'zustand'

interface CommunicationState {
    // Panel state
    isOpen: boolean
    activeTab: 'assistant' | 'messages'

    // Assistant state
    studentId: string | null
    studentName: string | null
    insightId: string | null
    initialMessage: string | null

    // Messages state
    selectedStudentId: string | null
    messagesView: 'list' | 'conversation'
    unreadMessagesCount: number

    // Panel actions
    openPanel: (tab: 'assistant' | 'messages') => void
    closePanel: () => void
    switchTab: (tab: 'assistant' | 'messages') => void

    // Assistant actions (backwards-compatible)
    openChat: (opts?: { studentId?: string; studentName?: string; insightId?: string; initialMessage?: string }) => void
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

    selectedStudentId: null,
    messagesView: 'list',
    unreadMessagesCount: 0,

    openPanel: (tab) => set({ isOpen: true, activeTab: tab }),

    closePanel: () => set({ isOpen: false }),

    switchTab: (tab) => set({ activeTab: tab }),

    openChat: (opts) => set({
        isOpen: true,
        activeTab: 'assistant',
        studentId: opts?.studentId ?? null,
        studentName: opts?.studentName ?? null,
        insightId: opts?.insightId ?? null,
        initialMessage: opts?.initialMessage ?? null,
    }),

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
