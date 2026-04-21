import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { fixtureProfile } from '@/lib/prescription/__fixtures__/prescription-output'
import type { PrescriptionData } from '@/actions/prescription/get-prescription-data'

vi.mock('@/actions/prescription/analyze-context', () => ({
    analyzeStudentContext: vi.fn(),
}))
vi.mock('@/actions/prescription/generate-program', () => ({
    generateProgram: vi.fn(),
}))
vi.mock('@/actions/prescription/questionnaire-actions', () => ({
    sendPrescriptionQuestionnaire: vi.fn(),
}))
// Heavy form — stub with a marker so the panel renders but we don't exercise it
vi.mock('@/components/prescription/prescription-profile-form', () => ({
    PrescriptionProfileForm: () => <div data-testid="profile-form-stub" />,
}))
// Tour uses zustand + onboarding plumbing; stub for clarity
vi.mock('@/components/onboarding/tours/tour-runner', () => ({
    TourRunner: () => null,
}))

import { AiPrescriptionPanel } from '../ai-prescription-panel'

const baseData: PrescriptionData = {
    profile: fixtureProfile,
    exercises: [],
    recentSessions: [],
    activeProgram: null,
    aiEnabled: true,
    previousProgramCount: 0,
    lastFormSubmissionDate: null,
    questionnaireSubmission: null,
    questionnaireTemplateId: null,
    formSubmissions: [],
}

const baseProps = {
    studentId: 's1',
    studentName: 'Carlos Pereira',
    prescriptionData: baseData,
    onClose: vi.fn(),
    onAcceptGeneratedProgram: vi.fn(),
}

describe('<AiPrescriptionPanel />', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns null when closed', () => {
        const { container } = render(<AiPrescriptionPanel open={false} {...baseProps} />)
        expect(container).toBeEmptyDOMElement()
    })

    it('renders header with student name and the anamnese content when open', () => {
        render(<AiPrescriptionPanel open {...baseProps} />)
        expect(screen.getByRole('dialog', { name: /IA · Carlos Pereira/ })).toBeInTheDocument()
        expect(screen.getByTestId('profile-form-stub')).toBeInTheDocument()
    })

    it('X button calls onClose', () => {
        const onClose = vi.fn()
        render(<AiPrescriptionPanel open {...baseProps} onClose={onClose} />)
        fireEvent.click(screen.getByRole('button', { name: /fechar painel de ia/i }))
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('deeplink initialPageState=done shows confirmation + "Fechar painel" CTA', () => {
        render(
            <AiPrescriptionPanel
                open
                {...baseProps}
                initialPageState="done"
                initialGenerationId="gen-seed"
            />,
        )
        expect(screen.getByText(/programa gerado/i)).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /^fechar painel$/i })).toBeInTheDocument()
    })

    it('clicking "Fechar painel" in done state calls onClose (onAccept already fired by the generation path)', () => {
        const onClose = vi.fn()
        const onAccept = vi.fn()
        render(
            <AiPrescriptionPanel
                open
                {...baseProps}
                onClose={onClose}
                onAcceptGeneratedProgram={onAccept}
                initialPageState="done"
                initialGenerationId="gen-xyz"
            />,
        )
        fireEvent.click(screen.getByRole('button', { name: /^fechar painel$/i }))
        expect(onClose).toHaveBeenCalledTimes(1)
        // onAccept is invoked by the fresh-generation path inside the hook,
        // not by the footer button — deeplink opens with initialPageState='done'
        // don't re-trigger it.
        expect(onAccept).not.toHaveBeenCalled()
    })
})
