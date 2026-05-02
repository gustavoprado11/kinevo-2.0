import { describe, it, expect } from 'vitest'
import { mapPendingForms } from '../map-pending-forms'

// These tests pin the contract of the joined form_submissions query (#5
// in get-dashboard-data). The previous code did two extra roundtrips after
// the parallel block to look up student name/avatar and template title;
// the new code joins via !inner so this transform must keep working off
// the embedded shape.

describe('mapPendingForms', () => {
    it('returns an empty array for null/undefined input', () => {
        expect(mapPendingForms(null)).toEqual([])
        expect(mapPendingForms(undefined)).toEqual([])
        expect(mapPendingForms([])).toEqual([])
    })

    it('reads studentName / studentAvatar from the embedded students join', () => {
        const rows = [{
            id: 'sub-1',
            student_id: 's-1',
            form_template_id: 't-1',
            submitted_at: '2026-04-30T10:00:00Z',
            students: { name: 'Maria', avatar_url: 'https://x/m.png' },
            form_templates: { title: 'Avaliação Inicial' },
        }]
        const out = mapPendingForms(rows)
        expect(out).toEqual([{
            id: 'sub-1',
            studentName: 'Maria',
            studentAvatar: 'https://x/m.png',
            templateTitle: 'Avaliação Inicial',
            submittedAt: '2026-04-30T10:00:00Z',
        }])
    })

    it('falls back to "Aluno" / null avatar when students join is missing', () => {
        const rows = [{
            id: 'sub-1',
            student_id: 's-1',
            form_template_id: 't-1',
            submitted_at: '2026-04-30T10:00:00Z',
            students: null,
            form_templates: { title: 'X' },
        }]
        const out = mapPendingForms(rows)
        expect(out[0].studentName).toBe('Aluno')
        expect(out[0].studentAvatar).toBeNull()
    })

    it('falls back to "Formulário" when form_templates join is missing', () => {
        const rows = [{
            id: 'sub-1',
            student_id: 's-1',
            form_template_id: 't-1',
            submitted_at: '2026-04-30T10:00:00Z',
            students: { name: 'Joana', avatar_url: null },
            form_templates: null,
        }]
        const out = mapPendingForms(rows)
        expect(out[0].templateTitle).toBe('Formulário')
    })

    it('handles students.avatar_url being null without crashing', () => {
        const rows = [{
            id: 'sub-1',
            student_id: 's-1',
            form_template_id: 't-1',
            submitted_at: '2026-04-30T10:00:00Z',
            students: { name: 'Maria', avatar_url: null },
            form_templates: { title: 'X' },
        }]
        const out = mapPendingForms(rows)
        expect(out[0].studentAvatar).toBeNull()
    })

    it('preserves order of input rows', () => {
        const rows = [
            { id: 'a', students: { name: 'A' }, form_templates: { title: 'A' }, submitted_at: '2026-01-01' },
            { id: 'b', students: { name: 'B' }, form_templates: { title: 'B' }, submitted_at: '2026-01-02' },
            { id: 'c', students: { name: 'C' }, form_templates: { title: 'C' }, submitted_at: '2026-01-03' },
        ]
        const out = mapPendingForms(rows)
        expect(out.map(f => f.id)).toEqual(['a', 'b', 'c'])
    })
})
