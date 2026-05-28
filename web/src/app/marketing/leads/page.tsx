import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LeadsClient, type LeadRow } from './leads-client'

export const dynamic = 'force-dynamic'

export default async function MarketingLeadsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, public_slug, landing_published')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')
    const t = trainer as { id: string; public_slug: string | null; landing_published: boolean | null }

    const { data: leads } = await supabase
        .from('trainer_leads')
        .select('id, name, email, whatsapp, goal, level, message, status, source, source_slug, created_at, converted_to_student_id')
        .eq('trainer_id', t.id)
        .order('created_at', { ascending: false })
        .limit(500)

    return (
        <div className="px-4 pt-2">
            <LeadsClient
                leads={(leads ?? []) as unknown as LeadRow[]}
                hasLanding={!!t.public_slug}
                landingPublished={!!t.landing_published}
                publicSlug={t.public_slug}
            />
        </div>
    )
}
