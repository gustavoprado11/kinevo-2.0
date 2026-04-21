import { redirect, permanentRedirect } from 'next/navigation'

interface PrescribeRedirectProps {
    params: Promise<{ id: string }>
    searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PrescribeRedirect({ params, searchParams }: PrescribeRedirectProps) {
    const { id } = await params
    const sp = await searchParams
    const scheduled = sp?.scheduled === 'true' ? '&scheduled=true' : ''
    // 308 permanent redirect — preserves method and indicates the move to search engines / clients.
    permanentRedirect(`/students/${id}/program/new?mode=ai${scheduled}`)
    // Unreachable, but keeps TS happy if permanentRedirect signature changes.
    redirect(`/students/${id}/program/new?mode=ai${scheduled}`)
}
