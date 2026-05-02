import type { PendingFormItem } from './get-dashboard-data'

// Maps the joined form_submissions rows (query #5 of getDashboardData) into
// the flat shape consumed by the dashboard widget. Lives in its own file so
// unit tests can import it without pulling the supabase admin client (and
// its env var requirements) into the test bundle.
export function mapPendingForms(rawForms: any[] | null | undefined): PendingFormItem[] {
    return (rawForms ?? []).map((f: any) => ({
        id: f.id,
        studentName: f.students?.name || 'Aluno',
        studentAvatar: f.students?.avatar_url || null,
        templateTitle: f.form_templates?.title || 'Formulário',
        submittedAt: f.submitted_at,
    }))
}
