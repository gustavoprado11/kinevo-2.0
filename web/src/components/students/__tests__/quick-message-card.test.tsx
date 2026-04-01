import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuickMessageCard } from '../quick-message-card'

// ── Mocks ──

const mockSendMessage = vi.fn().mockResolvedValue({ success: true })

vi.mock('@/app/messages/actions', () => ({
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
}))

// ── Tests ──

describe('QuickMessageCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders with title and textarea', () => {
        render(<QuickMessageCard studentId="s1" studentName="Maria" />)
        expect(screen.getByText(/Mensagem/i)).toBeInTheDocument()
        expect(screen.getByPlaceholderText(/Maria/i)).toBeInTheDocument()
    })

    it('renders suggestion buttons when provided', () => {
        const suggestions = [
            { emoji: '🎉', label: 'Parabenizar', message: 'Parabéns pela meta!' },
            { emoji: '💪', label: 'Motivar', message: 'Bora treinar!' },
        ]
        render(<QuickMessageCard studentId="s1" studentName="Maria" suggestions={suggestions} />)

        expect(screen.getByText('Parabenizar')).toBeInTheDocument()
        expect(screen.getByText('Motivar')).toBeInTheDocument()
    })

    it('fills textarea when clicking a suggestion', async () => {
        const user = userEvent.setup()
        const suggestions = [
            { emoji: '🎉', label: 'Parabenizar', message: 'Parabéns pela meta!' },
        ]
        render(<QuickMessageCard studentId="s1" studentName="Maria" suggestions={suggestions} />)

        await user.click(screen.getByText('Parabenizar'))
        const textarea = screen.getByPlaceholderText(/Maria/i) as HTMLTextAreaElement
        expect(textarea.value).toBe('Parabéns pela meta!')
    })

    it('hides suggestions when textarea has text', async () => {
        const user = userEvent.setup()
        const suggestions = [
            { emoji: '🎉', label: 'Parabenizar', message: 'Parabéns!' },
        ]
        render(<QuickMessageCard studentId="s1" studentName="Maria" suggestions={suggestions} />)

        const textarea = screen.getByPlaceholderText(/Maria/i)
        await user.type(textarea, 'Olá!')

        expect(screen.queryByText('Parabenizar')).not.toBeInTheDocument()
    })

    it('sends message on Enter key', async () => {
        const user = userEvent.setup()
        render(<QuickMessageCard studentId="s1" studentName="Maria" />)

        const textarea = screen.getByPlaceholderText(/Maria/i)
        await user.type(textarea, 'Bom treino!')
        await user.keyboard('{Enter}')

        await waitFor(() => {
            expect(mockSendMessage).toHaveBeenCalled()
        })
    })

    it('allows newline with Shift+Enter', async () => {
        const user = userEvent.setup()
        render(<QuickMessageCard studentId="s1" studentName="Maria" />)

        const textarea = screen.getByPlaceholderText(/Maria/i) as HTMLTextAreaElement
        await user.type(textarea, 'Linha 1')
        await user.keyboard('{Shift>}{Enter}{/Shift}')
        await user.type(textarea, 'Linha 2')

        // Should NOT have sent the message
        expect(mockSendMessage).not.toHaveBeenCalled()
    })

    it('shows success feedback after sending', async () => {
        const user = userEvent.setup()
        render(<QuickMessageCard studentId="s1" studentName="Maria" />)

        const textarea = screen.getByPlaceholderText(/Maria/i)
        await user.type(textarea, 'Bom treino!')
        await user.keyboard('{Enter}')

        await waitFor(() => {
            expect(screen.getByText(/Enviada/i)).toBeInTheDocument()
        })
    })

    it('does not send empty message', async () => {
        const user = userEvent.setup()
        render(<QuickMessageCard studentId="s1" studentName="Maria" />)

        const textarea = screen.getByPlaceholderText(/Maria/i)
        await user.click(textarea)
        await user.keyboard('{Enter}')

        expect(mockSendMessage).not.toHaveBeenCalled()
    })
})
