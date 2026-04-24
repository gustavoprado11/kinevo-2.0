import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SyncStatusBadge } from '../sync-status-badge'

describe('SyncStatusBadge', () => {
    it('não renderiza nada quando status é null', () => {
        const { container } = render(<SyncStatusBadge status={null} />)
        expect(container.innerHTML).toBe('')
    })

    it('não renderiza nada quando status é not_synced', () => {
        const { container } = render(<SyncStatusBadge status="not_synced" />)
        expect(container.innerHTML).toBe('')
    })

    it('mostra label "Google" quando synced', () => {
        render(<SyncStatusBadge status="synced" />)
        expect(screen.getByText(/Google/i)).toBeInTheDocument()
    })

    it('mostra label "Sincronizando" com spinner quando pending', () => {
        render(<SyncStatusBadge status="pending" />)
        expect(screen.getByText(/Sincronizando/i)).toBeInTheDocument()
    })

    it('mostra label "Erro sync" quando error', () => {
        render(<SyncStatusBadge status="error" />)
        expect(screen.getByText(/Erro sync/i)).toBeInTheDocument()
    })

    it('omite label quando compact=true', () => {
        render(<SyncStatusBadge status="synced" compact />)
        expect(screen.queryByText(/Google/)).not.toBeInTheDocument()
    })
})
