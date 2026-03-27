import { create } from 'zustand'

type PanelTab = 'assistant' | 'chat'

interface AssistantChatState {
    isOpen: boolean
    activeTab: PanelTab
    // Assistant context
    studentId: string | null
    studentName: string | null
    insightId: string | null
    initialMessage: string | null
    // Chat context (for deep-linking from insights)
    chatStudentId: string | null
    chatStudentName: string | null

    openChat: (opts?: {
        studentId?: string
        studentName?: string
        insightId?: string
        initialMessage?: string
    }) => void
    openMessages: (opts?: {
        studentId?: string
        studentName?: string
    }) => void
    switchTab: (tab: PanelTab) => void
    closeChat: () => void
}

export const useAssistantChatStore = create<AssistantChatState>()((set) => ({
    isOpen: false,
    activeTab: 'assistant',
    studentId: null,
    studentName: null,
    insightId: null,
    initialMessage: null,
    chatStudentId: null,
    chatStudentName: null,

    openChat: (opts) => set({
        isOpen: true,
        activeTab: 'assistant',
        studentId: opts?.studentId ?? null,
        studentName: opts?.studentName ?? null,
        insightId: opts?.insightId ?? null,
        initialMessage: opts?.initialMessage ?? null,
    }),

    openMessages: (opts) => set({
        isOpen: true,
        activeTab: 'chat',
        chatStudentId: opts?.studentId ?? null,
        chatStudentName: opts?.studentName ?? null,
    }),

    switchTab: (tab) => set({ activeTab: tab }),

    closeChat: () => set({
        isOpen: false,
        activeTab: 'assistant',
        studentId: null,
        studentName: null,
        insightId: null,
        initialMessage: null,
        chatStudentId: null,
        chatStudentName: null,
    }),
}))
