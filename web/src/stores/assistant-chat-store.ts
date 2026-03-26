import { create } from 'zustand'

interface AssistantChatState {
    isOpen: boolean
    studentId: string | null
    studentName: string | null
    insightId: string | null
    initialMessage: string | null
    openChat: (opts?: { studentId?: string; studentName?: string; insightId?: string; initialMessage?: string }) => void
    closeChat: () => void
}

export const useAssistantChatStore = create<AssistantChatState>()((set) => ({
    isOpen: false,
    studentId: null,
    studentName: null,
    insightId: null,
    initialMessage: null,

    openChat: (opts) => set({
        isOpen: true,
        studentId: opts?.studentId ?? null,
        studentName: opts?.studentName ?? null,
        insightId: opts?.insightId ?? null,
        initialMessage: opts?.initialMessage ?? null,
    }),

    closeChat: () => set({
        isOpen: false,
        studentId: null,
        studentName: null,
        insightId: null,
        initialMessage: null,
    }),
}))
