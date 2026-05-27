import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { LeadsClient, type LeadRow } from './leads-client'

export const dynamic = 'force-dynamic'

export default async function LeadsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, public_slug, landing_published')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')

    const trainerRow = trainer as {
        id: string
        name: string
        email: string | null
        avatar_url: string | null
        public_slug: string | null
        landing_published: boolean | null
    }

    const { data: leads } = await supabase
        .from('trainer_leads')
        .select('id, name, email, whatsapp, goal, level, message, status, source, source_slug, created_at')
        .eq('trainer_id', trainerRow.id)
        .order('created_at', { ascending: false })
        .limit(500)

    return (
        <AppLayout
            trainerName={trainerRow.name}
            trainerEmail={trainerRow.email ?? undefined}
            trainerAvatarUrl={trainerRow.avatar_url ?? undefined}
        >
            <LeadsClient
                leads={(leads ?? []) as unknown as LeadRow[]}
                hasLanding={!!trainerRow.public_slug}
                landingPublished={!!trainerRow.landing_published}
                publicSlug={trainerRow.public_slug}
            />
        </AppLayout>
    )
}
