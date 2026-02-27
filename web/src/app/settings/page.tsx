import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { stripe } from '@/lib/stripe'
import { AppLayout } from '@/components/layout'
import { BillingSection } from '@/components/settings/billing-section'
import { ProfileForm } from '@/components/settings/profile-form'

import { ChevronRight } from 'lucide-react'

export default async function SettingsPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) redirect('/login')

    const { data: trainer } = await supabase
        .from('trainers')
        .select('id, name, email, avatar_url, theme')
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

    if (!isActive) {
        redirect('/subscription/blocked')
    }

    return (
        <AppLayout
            trainerName={trainer.name}
            trainerEmail={trainer.email}
            trainerAvatarUrl={trainer.avatar_url}
            trainerTheme={trainer.theme ?? undefined}
        >
            <div className="mb-8">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-k-text-quaternary font-bold">
                    <span>Painel</span>
                    <ChevronRight size={10} strokeWidth={3} />
                    <span>Minha Conta</span>
                </div>
                <h1 className="text-3xl font-bold tracking-tighter bg-gradient-to-b from-[var(--gradient-text-from)] to-[var(--gradient-text-to)] bg-clip-text text-transparent">
                    Minha Conta
                </h1>
                <p className="mt-1 text-sm text-k-text-tertiary">Gerencie seu perfil e assinatura.</p>
            </div>



            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
                <div className="lg:col-span-1">
                    <ProfileForm trainer={trainer} />
                </div>
                <div className="lg:col-span-2">
                    <BillingSection
                        subscription={subscription!}
                        planName={planName}
                        planAmount={planAmount}
                        planCurrency={planCurrency}
                        planInterval={planInterval}
                        discountName={discountName}
                        discountPercent={discountPercent}
                        discountAmountOff={discountAmountOff}
                    />
                </div>
            </div>
        </AppLayout>
    )
}
