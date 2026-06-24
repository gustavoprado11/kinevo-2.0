import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { AppLayout } from '@/components/layout'
import { BillingSection } from '@/components/settings/billing-section'
import { AiPlanSection } from '@/components/settings/ai-plan-section'
import { getAiUsageSummary } from '@/lib/ai-usage/usage-summary'
import { ProfileForm } from '@/components/settings/profile-form'
import { ThemeSelector } from '@/components/settings/theme-selector'
import { ReportsPreferencesSection } from '@/components/settings/reports-preferences-section'
import { BrandingSection } from '@/components/settings/branding-section'
import { EquipeSection } from '@/components/settings/equipe-section'
import { SettingsSection } from '@/components/settings/settings-section'
import { DeveloperLinkCard } from '@/components/settings/developer-link-card'
import { getOrganizationContext } from '@/lib/studio/get-organization'

import { ChevronRight } from 'lucide-react'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, theme, auto_publish_reports, brand_name, brand_color, brand_logo_url, brand_show_powered_by')
        .eq('auth_user_id', user.id)
        .single()

    if (!trainer) {
        await supabase.auth.signOut()
        redirect('/login')
    }

    // Get subscription from DB
    let { data: subscription } = await supabaseAdmin
        .from('subscriptions')
        .select('status, current_period_end, cancel_at_period_end, stripe_customer_id, stripe_subscription_id')
        .eq('trainer_id', trainer.id)
        .single()

    // Sync from Stripe for fresh data (cancel_at_period_end, status changes, pricing)
    let planName = 'Kinevo Pro'
    let planAmount: number | null = null // in cents
    let planCurrency = 'brl'
    let planInterval = 'month'
    let discountName: string | null = null
    let discountPercent: number | null = null
    let discountAmountOff: number | null = null

    if (subscription?.stripe_subscription_id) {
        try {
            const stripeSub = await stripe.subscriptions.retrieve(
                subscription.stripe_subscription_id,
                { expand: ['items.data', 'discount.coupon'] }
            )

            const item = stripeSub.items?.data?.[0]
            let periodEnd: string | null = null
            if (item?.current_period_end) {
                periodEnd = new Date(item.current_period_end * 1000).toISOString()
            } else if (stripeSub.trial_end) {
                periodEnd = new Date(stripeSub.trial_end * 1000).toISOString()
            }

            // Extract plan pricing from subscription item
            if (item?.price) {
                planAmount = item.price.unit_amount
                planCurrency = item.price.currency || 'brl'
                planInterval = item.price.recurring?.interval || 'month'
                // Try to get product name
                const productId = typeof item.price.product === 'string' ? item.price.product : (item.price.product as any)?.id
                if (productId) {
                    try {
                        const product = await stripe.products.retrieve(productId)
                        if (product.name) planName = product.name
                    } catch {
                        // keep default name
                    }
                }
            }

            // Extract discount/coupon info (Stripe v20+: discounts is array, coupon lives in source.coupon)
            const activeDiscount = stripeSub.discounts?.[0]
            if (activeDiscount && typeof activeDiscount !== 'string' && activeDiscount.source) {
                const couponRef = activeDiscount.source.coupon
                const coupon = couponRef && typeof couponRef !== 'string' ? couponRef : null
                if (coupon) {
                    discountName = coupon.name || null
                    if (coupon.percent_off) {
                        discountPercent = coupon.percent_off
                    } else if (coupon.amount_off) {
                        discountAmountOff = coupon.amount_off
                    }
                }
            }

            // Update DB with fresh data
            await supabaseAdmin.from('subscriptions')
                .update({
                    status: stripeSub.status as string,
                    current_period_end: periodEnd,
                    cancel_at_period_end: stripeSub.cancel_at_period_end,
                })
                .eq('trainer_id', trainer.id)

            // Use fresh data for rendering
            subscription = {
                ...subscription,
                status: stripeSub.status as string,
                current_period_end: periodEnd,
                cancel_at_period_end: stripeSub.cancel_at_period_end,
            }
        } catch (err) {
            console.error('[settings] Stripe sync error:', err)
            // Continue with DB data if Stripe is unreachable
        }
    }

    const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

    // Estúdio: dono/coach de academia é liberado pela assinatura da ACADEMIA,
    // não pela solo. (Reusa o sistema atual; ver get-trainer.ts / org-access.)
    const orgCtx = await getOrganizationContext()
    // Solo sem assinatura ativa NÃO é mais bloqueado (decisão Gustavo: cai no Gratuito,
    // entra limitado) — e vê justamente esta tela para fazer upgrade. Só o estúdio
    // mantém o gate de organização.
    if (!isActive && orgCtx) {
        const orgStatus = orgCtx.organization.subscription_status
        if (orgStatus !== 'active' && orgStatus !== 'trialing') {
            redirect('/estudio/blocked')
        }
    }

    // Coaches da academia (para a aba Equipe)
    let orgCoaches: { trainerId: string; role: string; name: string; email: string }[] = []
    if (orgCtx) {
        const { data: coachesRaw } = await supabase
            .from('organization_members')
            .select('trainer_id, role, trainer:trainers(id, name, email)')
            .eq('organization_id', orgCtx.organization.id)
            .eq('status', 'active')
        orgCoaches = (coachesRaw ?? []).map((m: any) => {
            const t = Array.isArray(m.trainer) ? m.trainer[0] : m.trainer
            return {
                trainerId: m.trainer_id as string,
                role: m.role as string,
                name: (t?.name ?? '—') as string,
                email: (t?.email ?? '') as string,
            }
        })
    }

    // Numeração das seções: Landing saiu pra /marketing (era 03). Voltamos
    // ao layout original: 01 Você · 02 Marca · 03 Preferências · 04 Org? · 04/05 Assinatura.
    const orgNumber = orgCtx ? '04' : null
    const assinaturaNumber = orgCtx ? '05' : '04'
    const aiPlanNumber = orgCtx ? '06' : '05'

    // Resumo de uso de IA do ciclo (medidor + tier atual). Tenant isolation:
    // só o trainer da sessão. Não trava se falhar — degrada pra GUI (null → sem medidor).
    let aiUsage: Awaited<ReturnType<typeof getAiUsageSummary>> | null = null
    try {
        aiUsage = await getAiUsageSummary(supabaseAdmin, trainer.id)
    } catch (e) {
        console.error('[settings] getAiUsageSummary falhou — seção de IA sem medidor:', e)
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme as 'light' | 'dark' | 'system' | null}
        >
            {/* ── Header: breadcrumb + título ── */}
            <div className="mb-10 border-b border-k-border-primary pb-7">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold text-k-text-quaternary">
                    <span>Painel</span>
                    <ChevronRight size={10} strokeWidth={3} />
                    <span>Configurações</span>
                </div>
                <h1 className="bg-gradient-to-b from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-3xl font-bold tracking-tighter text-transparent">
                    Configurações
                </h1>
                <p className="mt-1 max-w-xl text-sm text-k-text-tertiary">
                    Sua conta, sua marca, suas preferências e sua assinatura.
                </p>
            </div>

            {/* ── 01 · Você ── */}
            <SettingsSection number="01" title="Você" hint="Identidade pessoal na plataforma">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
                    <ProfileForm trainer={trainer} />
                    <DeveloperLinkCard />
                </div>
            </SettingsSection>

            {/* ── 02 · Sua marca ── */}
            <SettingsSection number="02" title={orgCtx ? 'Marca do estúdio' : 'Sua marca'} hint="Como o app do aluno se apresenta">
                <BrandingSection
                    isStudio={!!orgCtx}
                    trainer={{
                        name: trainer.name,
                        brand_name: (trainer as { brand_name?: string | null }).brand_name ?? null,
                        brand_color: (trainer as { brand_color?: string | null }).brand_color ?? null,
                        brand_logo_url: (trainer as { brand_logo_url?: string | null }).brand_logo_url ?? null,
                    }}
                />
            </SettingsSection>

            {/* ── 03 · Preferências do app ── */}
            <SettingsSection number="03" title="Preferências do app" hint="Como o sistema se comporta no dia a dia">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 items-stretch">
                    <ThemeSelector initialTheme={trainer.theme as 'light' | 'dark' | 'system' | null} />
                    <ReportsPreferencesSection initialAutoPublish={trainer.auto_publish_reports ?? false} />
                </div>
            </SettingsSection>

            {/* ── 04 · Organização (só estúdio) ── */}
            {orgCtx && orgNumber && (
                <SettingsSection number={orgNumber} title="Organização" hint="Equipe da academia">
                    <EquipeSection
                        organization={{
                            id: orgCtx.organization.id,
                            name: orgCtx.organization.name,
                            visibility: orgCtx.organization.visibility,
                        }}
                        isManager={orgCtx.isManager}
                        currentTrainerId={orgCtx.trainerId}
                        coaches={orgCoaches}
                    />
                </SettingsSection>
            )}

            {/* ── 04/05 · Assinatura ── */}
            {subscription && (
                <SettingsSection number={assinaturaNumber} title="Assinatura" hint="Plano, cobrança e próxima fatura">
                    <BillingSection
                        subscription={subscription}
                        planName={planName}
                        planAmount={planAmount}
                        planCurrency={planCurrency}
                        planInterval={planInterval}
                        discountName={discountName}
                        discountPercent={discountPercent}
                        discountAmountOff={discountAmountOff}
                    />
                </SettingsSection>
            )}

            {/* ── 05/06 · Plano e IA ── */}
            {/* id="planos": destino dos CTAs de upgrade (muro do Assistente, cap de aluno). */}
            <div id="planos" className="scroll-mt-20">
                <SettingsSection number={aiPlanNumber} title="Plano e IA" hint="Seus créditos de IA e os planos disponíveis">
                    <AiPlanSection summary={aiUsage} />
                </SettingsSection>
            </div>
        </AppLayout>
    )
}
