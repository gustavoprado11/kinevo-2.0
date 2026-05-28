import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LandingEditor, type EditorTrainer } from './landing-editor'
import { LandingSection } from '@/components/settings/landing-section'

export const dynamic = 'force-dynamic'

const TRAINER_COLUMNS =
    'id, name, email, avatar_url, public_slug, landing_published, ' +
    'landing_headline, landing_subheadline, landing_bio, landing_city, ' +
    'landing_cref, landing_certifications, landing_specializations, ' +
    'landing_year_started, landing_price_label, ' +
    'landing_stats, landing_testimonials, landing_faq, landing_hero_image_url'

export default async function MarketingLandingPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select(TRAINER_COLUMNS)
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')

    const row = trainer as unknown as EditorTrainer

    return (
        <div className="mx-auto max-w-[1500px] px-4 pt-4 pb-10 space-y-5">
            {/* Card de URL + publicação (movido do /settings) */}
            <LandingSection
                initialSlug={row.public_slug}
                landingPublished={!!row.landing_published}
                trainerName={row.name}
            />

            {/* Editor de conteúdo */}
            <LandingEditor trainer={row} />
        </div>
    )
}
