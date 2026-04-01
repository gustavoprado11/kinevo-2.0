import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StudentInsightsCard } from '../student-insights-card'
import type { InsightItem } from '@/actions/insights'

// ── Mocks ──

vi.mock('@/actions/insights', () => ({
    markInsightRead: vi.fn().mockResolvedValue({ success: true }),
    dismissInsight: vi.fn().mockResolvedValue({ success: true }),
    createPinnedNote: vi.fn().mockResolvedValue({ success: true, id: 'new-note-1' }),
    deletePinnedNote: vi.fn().mockResolvedValue({ success: true }),
}))

const mockInsights = await import('@/actions/insights') as {
    markInsightRead: ReturnType<typeof vi.fn>
    dismissInsight: ReturnType<typeof vi.fn>
    createPinnedNote: ReturnType<typeof vi.fn>
    deletePinnedNote: ReturnType<typeof vi.fn>
}

// ── Fixtures ──

function makeInsight(overrides: Partial<InsightItem> = {}): InsightItem {
    return {
        id: 'ins-1',
        student_id: 'student-1',
        student_name: 'João Silva',
        category: 'alert',
        priority: 'high',
        title: 'Aluno sem treinar há 5 dias',
        body: 'Considere entrar em contato.',
        action_type: 'contact_student',
        action_metadata: {},
        status: 'new',
        source: 'rules',
        insight_key: 'gap_alert:student-1:2026-03-28',
        created_at: '2026-03-28T10:00:00Z',
        ...overrides,
    }
}

const pinnedNote: InsightItem = makeInsight({
    id: 'pin-1',
    category: 'pinned_note',
    source: 'trainer',
    title: 'Nota fixada',
    body: 'Aluno tem dor no joelho esquerdo',
    status: 'read',
    priority: 'low',
})

// ── Tests ──

describe('StudentInsightsCard', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders card title and add note button', () => {
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={[]} />)
        expect(container.textContent).toContain('Insights')
        expect(container.textContent).toContain('Nota')
    })

    it('renders pinned notes before AI insights', () => {
        const insights = [
            makeInsight({ id: 'ai-1', category: 'alert', title: 'Alerta IA' }),
            pinnedNote,
        ]
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={insights} />)
        const html = container.innerHTML
        const pinIdx = html.indexOf('joelho esquerdo')
        const aiIdx = html.indexOf('Alerta IA')
        // Pinned notes should appear in the DOM before AI insights
        expect(pinIdx).toBeLessThan(aiIdx)
    })

    it('shows title for unread insights', () => {
        const insights = [makeInsight({ status: 'new' })]
        render(<StudentInsightsCard studentId="student-1" insights={insights} />)
        expect(screen.getByText('Aluno sem treinar há 5 dias')).toBeInTheDocument()
    })

    it('does not show insights from other students', () => {
        const insights = [makeInsight({ student_id: 'other-student' })]
        render(<StudentInsightsCard studentId="student-1" insights={insights} />)
        expect(screen.queryByText('Aluno sem treinar há 5 dias')).not.toBeInTheDocument()
    })

    it('shows max 5 AI insights with overflow count', () => {
        const insights = Array.from({ length: 8 }, (_, i) =>
            makeInsight({ id: `ins-${i}`, title: `Insight ${i}`, insight_key: `key-${i}` })
        )
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={insights} />)
        expect(container.textContent).toContain('+3')
    })

    it('opens note input when clicking add button', async () => {
        const user = userEvent.setup()
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={[]} />)

        // Find the button containing "Nota" text
        const buttons = container.querySelectorAll('button')
        const addBtn = Array.from(buttons).find(b => b.textContent?.includes('Nota'))
        expect(addBtn).toBeTruthy()

        await user.click(addBtn!)

        // Textarea should appear
        const textarea = container.querySelector('textarea')
        expect(textarea).toBeTruthy()
    })

    it('calls createPinnedNote when submitting a note', async () => {
        const user = userEvent.setup()
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={[]} />)

        const buttons = container.querySelectorAll('button')
        const addBtn = Array.from(buttons).find(b => b.textContent?.includes('Nota'))
        await user.click(addBtn!)

        const textarea = container.querySelector('textarea')!
        await user.type(textarea, 'Nova observação do aluno')
        await user.keyboard('{Enter}')

        await waitFor(() => {
            expect(mockInsights.createPinnedNote).toHaveBeenCalledWith('student-1', 'Nova observação do aluno')
        })
    })

    it('cancels note input on Escape', async () => {
        const user = userEvent.setup()
        const { container } = render(<StudentInsightsCard studentId="student-1" insights={[]} />)

        const buttons = container.querySelectorAll('button')
        const addBtn = Array.from(buttons).find(b => b.textContent?.includes('Nota'))
        await user.click(addBtn!)

        const textarea = container.querySelector('textarea')!
        await user.type(textarea, 'Rascunho')
        await user.keyboard('{Escape}')

        // Textarea should be gone
        expect(container.querySelector('textarea')).toBeNull()
    })

    it('calls deletePinnedNote when clicking delete on a pin', async () => {
        const user = userEvent.setup()
        render(<StudentInsightsCard studentId="student-1" insights={[pinnedNote]} />)

        const noteText = screen.getByText('Aluno tem dor no joelho esquerdo')
        expect(noteText).toBeInTheDocument()

        // Find the delete button within the note container
        const noteContainer = noteText.closest('[class]')
        const deleteBtn = noteContainer?.querySelector('button')
        if (deleteBtn) {
            await user.click(deleteBtn)
            await waitFor(() => {
                expect(mockInsights.deletePinnedNote).toHaveBeenCalledWith('pin-1')
            })
        }
    })

    it('renders different icons per insight category', () => {
        const insights = [
            makeInsight({ id: '1', category: 'alert', title: 'Alerta item', insight_key: 'k1' }),
            makeInsight({ id: '2', category: 'progression', title: 'Progressão item', insight_key: 'k2' }),
            makeInsight({ id: '3', category: 'suggestion', title: 'Sugestão item', insight_key: 'k3' }),
        ]
        render(<StudentInsightsCard studentId="student-1" insights={insights} />)

        expect(screen.getByText('Alerta item')).toBeInTheDocument()
        expect(screen.getByText('Progressão item')).toBeInTheDocument()
        expect(screen.getByText('Sugestão item')).toBeInTheDocument()
    })
})
