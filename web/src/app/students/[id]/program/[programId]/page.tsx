import { redirect } from 'next/navigation'

interface PageProps {
    params: Promise<{
        id: string
        programId: string
    }>
}

// The program is viewed/managed through its /edit route. The bare
// /students/[id]/program/[programId] URL has no page of its own, so instead of
// 404ing (e.g. on an old bookmark) we forward to the editor.
export default async function ProgramRedirectPage({ params }: PageProps) {
    const { id, programId } = await params
    redirect(`/students/${id}/program/${programId}/edit`)
}
