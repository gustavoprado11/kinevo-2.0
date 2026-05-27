import { redirect } from 'next/navigation'
import { AppLayout } from '@/components/layout/app-layout'
import { createClient } from '@/lib/supabase/server'
import { MarketingTabs } from './marketing-tabs'

export const dynamic = 'force-dynamic'

/**
 * Hub /marketing — agrupa landing pública, leads e (em breve) analytics
 * num só lugar. AppLayout + tabs ficam aqui pra não duplicar em cada child.
 *
 * Cada child page (page.tsx, leads/page.tsx, landing/page.tsx) renderiza
 * só o conteúdo da própria tab.
 */
export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url')
        .eq('auth_user_id', user.id)
        .single()
    if (!trainer) redirect('/login')

    const row = trainer as { id: string; name: string; email: string | null; avatar_url: string | null }

    return (
        <AppLayout
            trainerName={row.name}
            trainerEmail={row.email ?? undefined}
            trainerAvatarUrl={row.avatar_url ?? undefined}
        >
            <div className="mx-auto max-w-[1500px] px-4 pt-6">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-k-text-primary">Marketing</h1>
                        <p className="text-sm text-k-text-tertiary mt-1">
                            Sua landing pública, leads e tudo que captura novos alunos.
                        </p>
                    </div>
                </div>
                <MarketingTabs />
            </div>
            {children}
        </AppLayout>
    )
}
