'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface CheckoutPollingProps {
    trainerName: string
}

export function CheckoutPolling({ trainerName }: CheckoutPollingProps) {
    const router = useRouter()
    const [timedOut, setTimedOut] = useState(false)

    useEffect(() => {
        const supabase = createClient()
        let attempts = 0
        const maxAttempts = 5 // 5 attempts × 2s = 10s total

        const interval = setInterval(async () => {
            attempts++

            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data: trainer } = await supabase
                .from('trainers')
                .select('id')
                .eq('auth_user_id', user.id)
                .single()

            if (!trainer) return

            const { data: subscription } = await supabase
                .from('subscriptions')
                .select('status')
                .eq('trainer_id', trainer.id)
                .single()

            const isActive = subscription?.status === 'trialing' || subscription?.status === 'active'

            if (isActive) {
                clearInterval(interval)
                // Navigate to dashboard without the checkout param
                router.replace('/dashboard')
                router.refresh()
                return
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval)
                setTimedOut(true)
            }
        }, 2000)

        return () => clearInterval(interval)
    }, [router])

    if (timedOut) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900">
                <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md text-center">
                    <h2 className="text-xl font-bold text-white mb-4">Processamento em andamento</h2>
                    <p className="text-gray-400 mb-6">
                        Seu pagamento está sendo processado. Isso pode levar alguns instantes.
                    </p>
                    <button
                        onClick={() => {
                            setTimedOut(false)
                            window.location.href = '/dashboard?checkout=success'
                        }}
                        className="w-full py-3 px-4 bg-violet-600 hover:bg-violet-700 text-white font-medium rounded-lg transition-colors"
                    >
                        Tentar novamente
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900">
            <div className="text-center">
                <div className="w-12 h-12 border-4 border-violet-500 border-t-transparent rounded-full animate-spin mx-auto mb-6" />
                <h2 className="text-xl font-bold text-white mb-2">Finalizando configuração da conta...</h2>
                <p className="text-gray-400">Olá, {trainerName}. Estamos ativando sua assinatura.</p>
            </div>
        </div>
    )
}
