import { describe, it, expect, beforeEach } from 'vitest'
import { useCommunicationStore, useAssistantChatStore } from '../communication-store'

const store = () => useCommunicationStore.getState()

beforeEach(() => {
    // Reset store to initial state before each test
    useCommunicationStore.setState({
        isOpen: false,
        activeTab: 'assistant',
        studentId: null,
        studentName: null,
        insightId: null,
        initialMessage: null,
        selectedStudentId: null,
        messagesView: 'list',
        unreadMessagesCount: 0,
    })
})

describe('communication-store', () => {
    // ── openPanel ──

    describe('openPanel', () => {
        it('opens panel on assistant tab', () => {
            store().openPanel('assistant')
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('assistant')
        })

        it('opens panel on messages tab', () => {
            store().openPanel('messages')
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('messages')
        })
    })

    // ── switchTab ──

    describe('switchTab', () => {
        it('switches tab without closing panel', () => {
            store().openPanel('assistant')
            store().switchTab('messages')
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('messages')
        })

        it('switches back to assistant', () => {
            store().openPanel('messages')
            store().switchTab('assistant')
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('assistant')
        })
    })

    // ── closePanel ──

    describe('closePanel', () => {
        it('closes panel but preserves activeTab', () => {
            store().openPanel('messages')
            store().closePanel()
            expect(store().isOpen).toBe(false)
            expect(store().activeTab).toBe('messages')
        })
    })

    // ── openConversation / backToList ──

    describe('openConversation', () => {
        it('sets selectedStudentId and switches to conversation view', () => {
            store().openConversation('student-123')
            expect(store().selectedStudentId).toBe('student-123')
            expect(store().messagesView).toBe('conversation')
        })
    })

    describe('backToList', () => {
        it('clears selectedStudentId and switches to list view', () => {
            store().openConversation('student-123')
            store().backToList()
            expect(store().selectedStudentId).toBeNull()
            expect(store().messagesView).toBe('list')
        })
    })

    // ── openChat (backwards-compatible assistant action) ──

    describe('openChat', () => {
        it('opens panel on assistant tab with context', () => {
            store().openChat({
                studentId: 'stu-1',
                studentName: 'Gustavo',
                insightId: 'gap_alert:abc',
                initialMessage: 'Olá',
            })
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('assistant')
            expect(store().studentId).toBe('stu-1')
            expect(store().studentName).toBe('Gustavo')
            expect(store().insightId).toBe('gap_alert:abc')
            expect(store().initialMessage).toBe('Olá')
        })

        it('opens with no args (general assistant)', () => {
            store().openChat()
            expect(store().isOpen).toBe(true)
            expect(store().activeTab).toBe('assistant')
            expect(store().studentId).toBeNull()
        })

        it('resets previous context when opening with different params', () => {
            store().openChat({ studentId: 'stu-1', insightId: 'gap_alert:abc' })
            store().openChat({ studentId: 'stu-2' })
            expect(store().studentId).toBe('stu-2')
            expect(store().insightId).toBeNull()
        })
    })

    // ── closeChat ──

    describe('closeChat', () => {
        it('closes panel (same as closePanel)', () => {
            store().openChat({ studentId: 'stu-1' })
            store().closeChat()
            expect(store().isOpen).toBe(false)
        })
    })

    // ── State preservation across tab switches ──

    describe('state preservation', () => {
        it('preserves messages state when switching to assistant and back', () => {
            store().openPanel('messages')
            store().openConversation('student-456')

            // Switch to assistant
            store().switchTab('assistant')
            expect(store().selectedStudentId).toBe('student-456')
            expect(store().messagesView).toBe('conversation')

            // Switch back to messages
            store().switchTab('messages')
            expect(store().selectedStudentId).toBe('student-456')
            expect(store().messagesView).toBe('conversation')
        })

        it('preserves assistant state when switching to messages and back', () => {
            store().openChat({ studentId: 'stu-1', studentName: 'Maria' })

            store().switchTab('messages')
            expect(store().studentId).toBe('stu-1')
            expect(store().studentName).toBe('Maria')

            store().switchTab('assistant')
            expect(store().studentId).toBe('stu-1')
            expect(store().studentName).toBe('Maria')
        })

        it('preserves state after close and reopen', () => {
            store().openPanel('messages')
            store().openConversation('student-789')
            store().closePanel()

            expect(store().selectedStudentId).toBe('student-789')
            expect(store().messagesView).toBe('conversation')

            store().openPanel('messages')
            expect(store().selectedStudentId).toBe('student-789')
            expect(store().messagesView).toBe('conversation')
        })
    })

    // ── Unread messages count ──

    describe('unreadMessagesCount', () => {
        it('setUnreadMessagesCount sets the count', () => {
            store().setUnreadMessagesCount(5)
            expect(store().unreadMessagesCount).toBe(5)
        })

        it('incrementUnreadMessages adds to count', () => {
            store().setUnreadMessagesCount(3)
            store().incrementUnreadMessages(1)
            expect(store().unreadMessagesCount).toBe(4)
        })

        it('incrementUnreadMessages adds arbitrary amount', () => {
            store().setUnreadMessagesCount(2)
            store().incrementUnreadMessages(10)
            expect(store().unreadMessagesCount).toBe(12)
        })

        it('decrementUnreadMessages subtracts from count', () => {
            store().setUnreadMessagesCount(5)
            store().decrementUnreadMessages(3)
            expect(store().unreadMessagesCount).toBe(2)
        })

        it('decrementUnreadMessages never goes below zero', () => {
            store().setUnreadMessagesCount(2)
            store().decrementUnreadMessages(999)
            expect(store().unreadMessagesCount).toBe(0)
        })

        it('count preserved when opening/closing panel', () => {
            store().setUnreadMessagesCount(7)
            store().openPanel('messages')
            expect(store().unreadMessagesCount).toBe(7)
            store().closePanel()
            expect(store().unreadMessagesCount).toBe(7)
        })

        it('count preserved when switching tabs', () => {
            store().setUnreadMessagesCount(4)
            store().openPanel('assistant')
            store().switchTab('messages')
            expect(store().unreadMessagesCount).toBe(4)
            store().switchTab('assistant')
            expect(store().unreadMessagesCount).toBe(4)
        })
    })

    // ── Backwards compatibility ──

    describe('backwards compatibility', () => {
        it('useAssistantChatStore is the same store', () => {
            expect(useAssistantChatStore).toBe(useCommunicationStore)
        })

        it('useAssistantChatStore.getState works', () => {
            useCommunicationStore.getState().openChat({ studentId: 'stu-1' })
            const state = useAssistantChatStore.getState()
            expect(state.isOpen).toBe(true)
            expect(state.studentId).toBe('stu-1')
        })
    })
})
