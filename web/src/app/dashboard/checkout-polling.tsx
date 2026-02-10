'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CheckoutPollingProps {
    trainerName: string
}

export function CheckoutPolling({ trainerName }: CheckoutPollingProps) {
    const router = useRouter()
    const [phase, setPhase] = useState<'polling' | 'syncing' | 'success' | 'failed'>('polling')

    const checkSubscription = useCallback(async (): Promise<boolean> => {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return false

        const { data: trainer } = await supabase
            .from('trainers')
            .select('id')
            .eq('auth_user_id', user.id)
            .single()

        if (!trainer) return false

        const { data: subscription } = await supabase
            .from('subscriptions')
            .select('status')
            .eq('trainer_id', trainer.id)
            .single()

        return subscription?.status === 'trialing' || subscription?.status === 'active'
    }, [])

    const syncFromStripe = useCallback(async (): Promise<boolean> => {
        try {
            const res = await fetch('/api/stripe/sync', { method: 'POST' })
            const json = await res.json()
            return json.status === 'trialing' || json.status === 'active'
        } catch {
            return false
        }
    }, [])

    useEffect(() => {
        let cancelled = false

        async function run() {
            // Phase 1: Poll DB for webhook-created subscription (16s, every 2s)
            for (let i = 0; i < 8; i++) {
                if (cancelled) return
                await new Promise(r => setTimeout(r, 2000))
                if (cancelled) return

                const found = await checkSubscription()
                if (found) {
                    setPhase('success')
                    router.replace('/dashboard')
                    router.refresh()
                    return
                }
            }

            if (cancelled) return

            // Phase 2: Webhook didn't fire — sync directly from Stripe API
            setPhase('syncing')

            for (let i = 0; i < 3; i++) {
                if (cancelled) return
                const synced = await syncFromStripe()
                if (synced) {
                    setPhase('success')
                    await new Promise(r => setTimeout(r, 500))
                    router.replace('/dashboard')
                    router.refresh()
                    return
                }
                if (cancelled) return
                await new Promise(r => setTimeout(r, 2000))
            }

            if (!cancelled) {
                setPhase('failed')
            }
        }

        run()
        return () => { cancelled = true }
    }, [router, checkSubscription, syncFromStripe])

    const handleRetry = async () => {
        setPhase('syncing')
        const synced = await syncFromStripe()
        if (synced) {
            setPhase('success')
            await new Promise(r => setTimeout(r, 500))
            router.replace('/dashboard')
            router.refresh()
        } else {
            setPhase('failed')
        }
    }

    if (phase === 'failed') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-xl">
                    <h2 className="mb-4 text-xl font-bold text-foreground">Processamento em andamento</h2>
                    <p className="mb-6 text-muted-foreground">
                        Seu pagamento foi recebido mas a ativação está demorando mais que o normal. Tente novamente ou aguarde alguns minutos.
                    </p>
                    <button
                        onClick={handleRetry}
                        className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-violet-500/20"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <h2 className="mb-2 text-xl font-bold text-foreground">
                    {phase === 'syncing' ? 'Sincronizando com o Stripe...' : 'Finalizando configuração da conta...'}
                </h2>
                <p className="text-muted-foreground">Olá, {trainerName}. Estamos ativando sua assinatura.</p>
            </div>
        </div>
    )
}
